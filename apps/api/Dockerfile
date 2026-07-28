# syntax=docker/dockerfile:1
# Multi-stage build. Build context is the REPO ROOT (see docker-compose.yml)
# so the pnpm workspace + @pocket-teach/api-types are available.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

# ---- build: install all deps + typecheck ----------------------------------
FROM base AS build
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/api-types/package.json packages/api-types/
COPY apps/api/package.json apps/api/
RUN pnpm install
COPY packages ./packages
COPY apps ./apps
RUN pnpm --filter api build

# ---- runtime: slim, non-root ----------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
RUN apk add --no-cache curl \
  && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app /app
WORKDIR /app/apps/api
USER app
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8787}/health" || exit 1

CMD ["pnpm", "start"]
