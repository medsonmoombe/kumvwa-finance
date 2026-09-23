import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { env } from '../config';
import { logger } from '../logger';

const prisma = new PrismaClient();
const MAX_ATTEMPTS = 5;

/** Log-only when SMTP_HOST is unset — nothing to connect to in dev. */
function transport(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
}

const sender: Transporter | null = transport();

/** Drains queued EmailOutbox rows to SMTP (or the dev console). */
export async function processEmailOutbox(): Promise<void> {
  const rows = await prisma.emailOutbox.findMany({
    where: { status: 'queued', attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: env.WORKER_BATCH,
  });

  for (const row of rows) {
    try {
      if (!sender) {
        logger.info({ to: row.to, subject: row.subject }, 'EMAIL(dev-console)');
      } else {
        await sender.sendMail({
          from: env.SMTP_FROM,
          to: row.to,
          subject: row.subject,
          text: row.body,
        });
      }
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { status: 'sent', sentAt: new Date() },
      });
    } catch (e) {
      const attempts = row.attempts + 1;
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
          error: String(e),
        },
      });
      logger.error({ err: e, id: row.id }, 'EMAIL failed');
    }
  }

  if (rows.length > 0) logger.info(`email-outbox: ${rows.length} processed`);
}
