import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { env } from './config';
import { logger } from './logger';

/**
 * Firebase Cloud Messaging sender (HTTP v1), built on Node's fetch + crypto so
 * the worker needs no Firebase SDK.
 *
 * The legacy `key=<server-key>` send endpoint this project once reserved an env
 * var for was retired by Google, so HTTP v1 with a service account is the only
 * supported path. Nothing here throws at import time: with no service account
 * configured `fcmSender()` returns null and the caller logs the push instead,
 * exactly like the email outbox does without SMTP.
 */
export type SendOutcome = 'sent' | 'unregistered' | 'failed';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FcmSender {
  send(deviceToken: string, message: PushMessage): Promise<SendOutcome>;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

function loadServiceAccount(): ServiceAccount | null {
  const raw = env.FCM_SERVICE_ACCOUNT_JSON.trim();
  if (!raw) return null;

  // Accept either the JSON itself or a path to it — a 2 KB private key in an
  // env var is painful to paste into most hosts' UIs.
  let text = raw;
  if (!raw.startsWith('{')) {
    try {
      text = readFileSync(raw, 'utf8');
    } catch (e) {
      logger.error({ err: e, path: raw }, 'FCM: service-account file unreadable — push disabled');
      return null;
    }
  }

  try {
    const json = JSON.parse(text) as Partial<ServiceAccount>;
    if (!json.client_email || !json.private_key) {
      throw new Error('client_email and private_key are required');
    }
    const projectId = json.project_id ?? env.FCM_PROJECT_ID;
    if (!projectId) throw new Error('project_id is required (or set FCM_PROJECT_ID)');
    return { project_id: projectId, client_email: json.client_email, private_key: json.private_key };
  } catch (e) {
    logger.error({ err: e }, 'FCM: service account invalid — push disabled');
    return null;
  }
}

/** Cached OAuth2 access token, refreshed a minute before it expires. */
let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url');

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(sa.private_key, 'base64url');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Google OAuth failed (${res.status}): ${bodyText.slice(0, 300)}`);
  }
  const data = JSON.parse(bodyText) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Google OAuth returned no access_token');

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

/** Built once at module load so a bad credential is visible in the logs at boot. */
const serviceAccount: ServiceAccount | null = loadServiceAccount();

export function fcmSender(): FcmSender | null {
  if (!serviceAccount) return null;
  const sa = serviceAccount;

  return {
    async send(deviceToken: string, message: PushMessage): Promise<SendOutcome> {
      let token: string;
      try {
        token = await accessToken(sa);
      } catch (e) {
        logger.error({ err: e }, 'FCM: could not mint an access token');
        return 'failed';
      }

      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: deviceToken,
              notification: { title: message.title, body: message.body },
              // FCM v1 rejects non-string data values.
              ...(message.data ? { data: message.data } : {}),
            },
          }),
        },
      );

      if (res.ok) return 'sent';

      const text = await res.text();
      // A token the app uninstalled from is dead weight — the caller deletes it
      // so the next notification does not pay for the round trip again.
      if (res.status === 404 || /UNREGISTERED|not-registered/i.test(text)) {
        return 'unregistered';
      }
      logger.warn({ status: res.status, body: text.slice(0, 300) }, 'FCM: send failed');
      return 'failed';
    },
  };
}