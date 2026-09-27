# Kumvwa — Friday Demo Runbook

Target state: API + worker on Railway (public HTTPS), console on a static host,
release APK pointing at the hosted API.

## 1. API + worker on Railway (fastest path to a public https URL)

1. Push the repo to GitHub. Railway → **New Project → Deploy from GitHub repo**.
2. Add **PostgreSQL** and **Redis** (Railway plugins — their URLs are injectable).
3. Add **MinIO** from Railway's template (or point `S3_*` at a free Cloudflare
   R2 bucket — also S3-compatible).
4. Two more services from the same repo:

| Service | Root | Build | Start |
|---|---|---|---|
| `api` | repo root | `pnpm install && pnpm --filter api prisma generate && pnpm --filter api build` | `pnpm --filter api prisma migrate deploy && node apps/api/dist/main.js` |
| `worker` | repo root | `pnpm install` | `pnpm --filter worker exec tsx apps/worker/src/main.ts` |

5. Env vars on **both** services — everything from `apps/api/.env.example` /
   `apps/worker/.env.example` with production values:
   - `NODE_ENV=prod`
   - real 48-char JWT/crypto secrets (`openssl rand -base64 48`)
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `REDIS_URL=${{Redis.REDIS_URL}}`
   - `CORS_ORIGINS=https://<console-url>`
   - `APP_BASE_URL` = console URL
   - `OTP_DEV_MODE=true` for the demo (codes fixed `123456`)
6. Generate a Railway **domain** for `api` → that's your `API_BASE_URL`
   (https — no cleartext needed on the phone).
7. Seed the platform admin once, locally:
   `DATABASE_URL=<railway-pg-url> pnpm --filter api prisma db seed`

## 2. Console on the web

`pnpm --filter console build` with `VITE_API_URL=https://<api-domain>/api/v1`
→ deploy `apps/console/dist/` to Cloudflare Pages or Netlify (free).
Set `CORS_ORIGINS` to that URL on the API service.

## 3. The APK

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://<api-domain>/api/v1
```

`Env.apiBaseUrl` reads the dart-define, so the release build points at the
hosted API automatically. (`usesCleartextTraffic` can be removed from the
manifest once the API URL is https.)

## 4. Push notifications (optional for the demo)

Boss action item: create the Firebase project (free Spark plan), add one
Android app with package `com.kumvwa.kumvwa_finance`, then:

1. Download `google-services.json` → `kumvwa_finance/android/app/`.
2. Root `android/build.gradle.kts` plugins:
   `id("com.google.gms.google-services") version "4.4.2" apply false`.
3. `android/app/build.gradle.kts` plugins: `id("com.google.gms.google-services")`.
4. Rebuild the APK. Until then `PushService` logs the dev note and the app
   runs normally — in-app notifications still work.

## 5. Demo script

1. **Setup (before):** console → register "Demo SACCO" (OTP `123456`, terms
   checkbox) → admin approves in queue → console Settings: upload logo + pick
   primary color → publish tenant terms → invite "Mwansa Bwalya"
   (email = your address; read the invite email in MailHog or copy the token
   from the console).
2. **On the phone:** install APK → enter invite code → complete account
   (password ≥ 8 + agree) → login → **profile stepper** (email, employment,
   income) → **platform terms + Download PDF** → accept → branded empty home.
3. **Client requests a loan** → shows the server-computed limit.
4. **Console:** request appears in inbox → open drawer → risk panel →
   **approve at 15%**.
5. **Phone:** refresh → loan appears **in the business's colors** with
   countdown → **Pay Now** (mobile money sheet) → balance updates →
   installment goes green.
6. **Console:** loan detail shows the repayment; dashboard/counts move.
7. Both devices got **notifications** (in-app for sure; push if Firebase
   config landed).

## Local pre-flight (before Railway)

```bash
docker compose -f docker-compose.dev.yml up -d   # postgres/redis/minio/mailhog
pnpm dev:api & pnpm dev:worker & pnpm dev:console
cd kumvwa_finance && flutter run                  # picks up Env.apiBaseUrl
```
