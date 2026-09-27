# React console — monorepo aware, served by nginx.
#
# Build context is the REPO ROOT:
#   docker build -f apps/console/Dockerfile -t kumvwa-console .
#
# VITE_API_URL is baked into the bundle at BUILD time and is resolved by the
# BROWSER, so it must be a host-reachable URL (http://localhost:8080/api/v1),
# never a compose service name.
FROM node:22-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/console/package.json apps/console/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile

COPY apps/console apps/console
COPY packages/core packages/core

ARG VITE_API_URL=http://localhost:8080/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter console build

FROM nginx:alpine AS runtime
COPY apps/console/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/console/dist /usr/share/nginx/html
EXPOSE 5173
