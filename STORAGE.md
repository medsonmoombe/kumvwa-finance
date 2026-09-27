# Document storage

One service, two drivers, one three-step flow. Every file the console or the
mobile app uploads goes through `FilesService` → `StorageService` → a driver,
and every file they display is a short-lived presigned URL from the same place.

## What is stored, and where it is viewed

| Kind | Uploaded from | Viewed from |
|---|---|---|
| `boz_certificate` | console: registration + business verification | console: verification page, admin queue, admin tenant detail |
| `tenant_logo` | console: Settings → App Branding | console branding preview, mobile app (loan cards, loan detail, invite screen) |
| `nrc_photo` | mobile: profile stepper (front **and** back) | console client detail (`?side=front\|back`), mobile stepper photo viewer |
| `kyc_document`, `other` | reserved — no caller yet | — |

## The flow

Every client does the same three steps; the API never proxies PII bytes.

1. `POST /files/upload-url` (lender) or `POST /files/client/upload-url` (borrower)
   → `{ fileId, uploadUrl, expiresInSec }`. The row is reserved now, so the
   `fileId` is stable; MIME is checked per kind and the declared size is capped.
2. `PUT <uploadUrl>` with the raw bytes — **straight to storage**, not through the API.
3. `POST /files/:fileId/confirm` → the API HEADs the object and stamps its real
   size + ETag. Until this succeeds the row is not a document.

Retrieval is always a fresh presigned GET:

- `GET /files/:id/download-url` — BOZ certificates, logos, admin review
- `GET /clients/:id/nrc-photo?side=front|back` — lender views a borrower's NRC
- `GET /clients/me/nrc-photo/:side` — borrower views their own NRC

**Presigned URLs live 900 seconds.** Viewers mint one when they open and never
cache it: a URL held in React state or Flutter state is stale by the next visit.

## Drivers

`STORAGE_DRIVER=local` (default) — files land in the project `docs/` folder
(gitignored) and are streamed through `/files/local-storage/*`, authorised by an
HMAC-signed `key`/`mime`/`expires`/`sig` query string (same trust model as a
presigned URL, so no Bearer token is needed). Best for dev and single-instance
demos.

`STORAGE_DRIVER=s3` — MinIO in dev, AWS S3 or Cloudflare R2 in production.
Switching is only this variable; nothing else in the codebase changes.

## Environment matrix

| | local dev | `docker compose` | production |
|---|---|---|---|
| `STORAGE_DRIVER` | `local` | `local` (volume-backed) | **`s3`** |
| `API_PUBLIC_URL` | `localhost` — `10.0.2.2` for the Android emulator | `http://localhost:8080/api/v1` | `https://<api-host>/api/v1` |
| `LOCAL_STORAGE_DIR` | `docs` | `/app/docs` | — |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | unused | unused (MinIO aliases are present) | required |

`API_PUBLIC_URL` is **not the API's own address — it is the address your clients
use.** Every upload URL and every logo/certificate NRC URL is minted from it, so
a loopback value looks healthy in the logs and breaks every upload and every
document view in production.

Boot guard (`loadEnv` → `assertDeployableStorage`):

- `NODE_ENV=prod` **refuses to start** if `API_PUBLIC_URL` is loopback, or if
  `S3_ENDPOINT` is loopback while the S3 driver is on.
- `STORAGE_DRIVER=local` in prod is allowed (a host *can* mount a persistent
  volume) but logs a loud error, because Render/Heroku/Fly default disks are
  ephemeral and lose every upload on the next deploy.

## Production checklist

1. `STORAGE_DRIVER=s3` — `render.yaml` sets this; set it in the dashboard too if
   the service is already live (a blueprint sync is what applies it).
2. `API_PUBLIC_URL=https://<api-host>/api/v1`.
3. `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` from the bucket
   provider. For R2 that is `https://<account>.r2.cloudflarestorage.com`.
4. **Bucket CORS.** The console PUTs from the browser straight to the bucket, so
   the bucket must allow it (the mobile app is native HTTP, so it needs no CORS):

   ```json
   [
     {
       "AllowedOrigins": ["https://your-console.example", "http://localhost:5173"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type", "*"],
       "ExposeHeaders": ["etag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

   MinIO's default `MINIO_API_CORS_ALLOW_ORIGIN=*` already covers dev; AWS S3 and
   R2 do not — paste the policy above into the bucket settings.
5. The console must be built with `VITE_API_URL` pointing at the same public API.

## Limits

- API: 10 MB per file; PDF, JPEG, PNG only, scoped per kind (`nrc_photo` and
  `tenant_logo` are image-only). The ceiling is re-checked against the bytes that
  actually arrive, not just the declared size.
- Console: additionally refuses > 5 MB for certificates and logos, client-side.
- Every certificate/NRC read is audited (`pii.read` / `file.download_url`).

## Verify

```bash
pnpm dev:api             # terminal 1 (STORAGE_DRIVER=local)
node verify-storage.mjs  # terminal 2
```

Registers a lender, mints an upload URL, PUTs bytes, confirms, downloads and
compares the bytes, submits the certificate for review, and asserts a tampered
signature (403) and a path traversal (`../../../win.ini`) are refused. It expects
the **local** driver, since it asserts the upload URL is `/files/local-storage/upload`.

Unit tests: `pnpm --filter api test` (covers `LocalStorageDriver` and the env
deploy guard).

## Troubleshooting

| Symptom | Cause |
|---|---|
| Console upload fails immediately; message names your storage host | Bucket CORS missing, or the storage host is unreachable from the browser |
| Phone: `Could not reach file storage (localhost…)` | `API_PUBLIC_URL` is loopback — set the LAN/emulator/public address |
| `confirm` → 400 "Upload not found in storage" | The PUT never landed (wrong bucket/host) or exceeded the size ceiling |
| Images render, then break after ~15 minutes | Presigned URL expired — viewers re-fetch on open by design |
| 403 "Invalid or expired storage signature" | Local-driver URL was tampered with or is older than 15 minutes |
| Everything 404s after a deploy | `STORAGE_DRIVER=local` on an ephemeral disk |
