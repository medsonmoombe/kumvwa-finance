# NestJS API — monorepo aware.
#
# Build context is the REPO ROOT (the workspace lockfile lives there):
#   docker build -f apps/api/Dockerfile -t kumvwa-api .
#
# Config is injected at runtime by compose; .env is deliberately excluded by
# .dockerignore so the image can never carry a developer's localhost URLs.
FROM node:22-alpine

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Manifests first: dependency installs stay cached across source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/console/package.json apps/console/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile

COPY packages/core packages/core
COPY apps/api apps/api
COPY apps/worker apps/worker

# Prisma client first (the api imports @prisma/client types), then the
# workspace build: core must compile before the api's tsc run. The worker is
# built into this same image so the `jobs` profile can run from it.
RUN pnpm --filter api exec prisma generate \
 && pnpm --filter @kumvwa/core build \
 && pnpm --filter api exec nest build \
 && pnpm --filter worker build

EXPOSE 8080

# Default: migrate + start API.
# Override dockerCommand in render.yaml to run the worker instead:
#   node apps/worker/dist/main.js
CMD ["sh", "-c", "pnpm --filter api exec prisma migrate deploy && pnpm --filter api exec prisma db seed && node apps/api/dist/src/main.js"]
