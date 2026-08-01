# syntax=docker/dockerfile:1
# Multi-stage build. Build context is the REPO ROOT (see docker-compose.yml)
# so the pnpm workspace + @pocket-teach/api-types are available.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

# ---- build: install all deps + compile to dist ---------------------------
FROM base AS build
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/api-types/package.json packages/api-types/
COPY apps/api/package.json apps/api/
RUN pnpm install
COPY packages ./packages
COPY apps ./apps
# Trailing "..." builds api's workspace deps (api-types → dist) before api itself.
RUN pnpm --filter "api..." build

# ---- runtime: slim, non-root ---------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
RUN apk add --no-cache curl git \
  && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app /app
WORKDIR /app/apps/api
USER app
EXPOSE 1212

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-1212}/health" || exit 1

CMD ["node", "dist/main.js"]
