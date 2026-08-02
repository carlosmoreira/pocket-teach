# Pocket Teach

Carry your `/teach` learning lessons everywhere. Pocket Teach is an **offline-first
PWA** backed by a **thin, stateless generation API** that re-implements Matt Pocock's
`/teach` methodology (mission → curated resources → glossary → a growing set of
beautiful, self-contained HTML lessons with inline quizzes) against a plain model API
instead of a Claude Code agent-on-a-filesystem.

- **The app owns the data** (Dexie/IndexedDB, lesson HTML as blobs). Reading is fully offline.
- **The API is a thin LLM gateway** behind a provider seam (Claude for v1) that encodes the `/teach` prompts, grounds via web search/fetch, and streams generation over SSE.

See `design.html` for the full product/architecture write-up.

## Monorepo layout

```
pocket-teach/
├── packages/
│   └── api-types/   # @pocket-teach/api-types — shared zod schemas + TS types (the wire contract)
└── apps/
    ├── api/         # Fastify SSE generation gateway (Claude over the Vercel AI SDK)
    └── frontend/    # Angular PWA (installable, offline-first)
```

## What's built

- **API:** grounded lesson generation (planner + writer, web search/fetch), project synthesis, amplify (clarify-in-place), and the teacher chat (`read_lesson` client-tool loop + `<proposal>`/`<record>` islands). Idempotency-key result cache, bearer auth, Docker.
- **Frontend:** Angular PWA foundation — installable/offline shell, Dexie schema, and a Settings screen that connects to the API. Library and the create/read/chat flows are in progress.

## Requirements

- Node **22+** (`.nvmrc` pins 22)
- pnpm **9+** (tested on 11.9)

## Install & run

```bash
pnpm install                        # from the repo root

# API
cp apps/api/.env.example apps/api/.env   # set ANTHROPIC_API_KEY for real generation
pnpm --filter api dev                    # watch mode (tsx) → http://localhost:1212

# Frontend
pnpm --filter frontend dev               # → http://localhost:4200 (point Settings at the API)
```

Every API route needs `Authorization: Bearer <GATEWAY_TOKEN>` **except** `GET /health`.
The default dev token is `dev-token`.

## Endpoints

| Method | Path                | Auth | Notes                                         |
| ------ | ------------------- | ---- | --------------------------------------------- |
| GET    | `/health`           | no   | `{status:"ok"}` — container `HEALTHCHECK`     |
| POST   | `/generate/project` | yes  | SSE — mission + lesson 1 (interview inputs)   |
| POST   | `/generate/lesson`  | yes  | SSE — next grounded lesson                    |
| POST   | `/generate/amplify` | yes  | SSE — clarify-in-place, same objective + slug |
| POST   | `/chat`             | yes  | SSE — teacher chat (grounded + `read_lesson`) |
| POST   | `/backup`           | yes  | store the workspace backup blob               |
| GET    | `/backup`           | yes  | fetch the latest backup blob                  |

## Docker (API)

```bash
cp apps/api/.env.example apps/api/.env
cd apps/api
docker compose up --build
```

Multi-stage build on `node:22-alpine`, runs non-root, with a `curl /health`
`HEALTHCHECK`. The backup blob store persists to `apps/api/data/` (gitignored).

## Configuration (API `.env`)

| Var                 | Default           | Purpose                                |
| ------------------- | ----------------- | -------------------------------------- |
| `PORT`              | `1212`            | Listen port                            |
| `GATEWAY_TOKEN`     | `dev-token`       | Single static bearer token             |
| `PROVIDER`          | `claude`          | Active LLM provider (v1: claude)       |
| `PLANNER_MODEL`     | `claude-sonnet-5` | Planner model                          |
| `WRITER_MODEL`      | `claude-sonnet-5` | Writer model (switchable to a premium) |
| `ANTHROPIC_API_KEY` | —                 | Required for real generation/chat      |
