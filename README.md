# Pocket Teach

Carry your `/teach` learning lessons everywhere. Pocket Teach is an **offline-first
PWA** backed by a **thin, stateless generation gateway** that re-implements Matt
Pocock's `/teach` methodology (mission → curated resources → glossary → a growing set
of beautiful, self-contained HTML lessons with inline quizzes) against a plain model
API instead of a Claude Code agent-on-a-filesystem.

- **The app owns the data** (Dexie/IndexedDB, lesson HTML as blobs). Reading is fully
  offline.
- **The gateway is a thin LLM gateway** behind a provider seam (Claude for v1) that
  encodes the `/teach` prompts and streams generation over SSE.

See `design.html` for the full product/architecture write-up.

## Monorepo layout

```
pocket-teach/
├── packages/
│   └── api-types/      # @pocket-teach/api-types — shared zod schemas + TS types (the wire contract)
└── apps/
    └── gateway/        # Fastify SSE generation gateway (this chunk)
    # apps/web (Angular PWA) lands in a later chunk
```

## Status — CHUNK 1

Runnable monorepo, shared contracts, and a **gateway skeleton**. The HTTP surface,
SSE streaming, idempotency cache, auth, and provider seam are **real**; the
model/prompt/search **logic is stubbed** (canned but contract-valid output) and marked
with `// TODO(chunk-2)`.

## Requirements

- Node **22+** (`.nvmrc` pins 22; developed on 24)
- pnpm **9+** (tested on 11.9)

## Install & run

```bash
pnpm install                      # from the repo root

# copy the example env (optional — sensible dev defaults exist)
cp apps/gateway/.env.example apps/gateway/.env

pnpm --filter gateway dev         # watch mode (tsx)
# or:  pnpm start                 # one-shot
# or:  pnpm --filter gateway build   # typecheck the whole gateway
```

The gateway listens on `http://localhost:8787` (`PORT`). Every route needs
`Authorization: Bearer <GATEWAY_TOKEN>` **except** `GET /health`. The default dev token
is `dev-token`.

### Try it with curl

```bash
# health (no auth)
curl -s localhost:8787/health

# stream a lesson (canned SSE: planning → researching → plan → writing → done)
curl -N -X POST localhost:8787/generate/lesson \
  -H 'Authorization: Bearer dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"contextMarkdown":"# Mission\nLearn X","requestId":"abc-123"}'

# repeat the SAME requestId → returns the cached finished result (never re-billed)
```

## Endpoints

| Method | Path                 | Auth | Notes                                             |
| ------ | -------------------- | ---- | ------------------------------------------------- |
| GET    | `/health`            | no   | `{status:"ok"}` — container `HEALTHCHECK`         |
| POST   | `/generate/project`  | yes  | SSE — mission + lesson 1 (interview inputs)        |
| POST   | `/generate/lesson`   | yes  | SSE — next lesson                                 |
| POST   | `/generate/amplify`  | yes  | SSE — clarify-in-place, same objective + slug      |
| POST   | `/chat`              | yes  | SSE — teacher chat (canned; tool-loop stubbed)     |
| POST   | `/backup`            | yes  | store the workspace backup blob                    |
| GET    | `/backup`            | yes  | fetch the latest backup blob                       |

## Docker

```bash
cp apps/gateway/.env.example apps/gateway/.env
cd apps/gateway
docker compose up --build
```

Multi-stage build on `node:22-alpine`, runs non-root, with a `curl /health`
`HEALTHCHECK`. The backup blob store is persisted to `apps/gateway/data/` (gitignored).

## Configuration (gateway `.env`)

| Var                 | Default            | Purpose                                  |
| ------------------- | ------------------ | ---------------------------------------- |
| `PORT`              | `8787`             | Listen port                              |
| `GATEWAY_TOKEN`     | `dev-token`        | Single static bearer token               |
| `PROVIDER`          | `claude`           | Active LLM provider (v1: claude)         |
| `PLANNER_MODEL`     | `claude-sonnet-5`  | Planner model                            |
| `WRITER_MODEL`      | `claude-sonnet-5`  | Writer model (switchable to a premium)   |
| `ANTHROPIC_API_KEY` | —                  | Optional in chunk 1; required in chunk 2 |
