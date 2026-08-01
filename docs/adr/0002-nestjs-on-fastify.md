# 2. NestJS on the Fastify adapter for the backend

Status: accepted

## Context

The backend began as a small Fastify app. It is now growing service-oriented: an LLM
Provider seam, a Search provider seam, a Workspace store, an agentic Teacher loop with
a Tool registry, and several route groups. The current flat `routes/`, `providers/`,
`search/` layout has no dependency-injection story and is starting to sprawl.

NestJS is not an HTTP server; it is a module/dependency-injection framework that runs
on top of an underlying engine — Express (its default) or Fastify. The seams above map
directly onto Nest modules and injectable services.

## Decision

Rebuild the backend as a NestJS application on the Fastify adapter
(`@nestjs/platform-fastify`). Module boundaries follow the domain glossary
(`CONTEXT.md`): Workspace, LLM Providers, Search, and Teaching, plus cross-cutting
Config, Auth, and Health.

Validation stays on Zod via the shared `@pocket-teach/api-types` schemas (a Zod pipe),
not class-validator DTOs, so the wire contract cannot fork from the frontend.

## Consequences

- Dependency injection makes Provider/Search swapping (Claude → local model) a module
  binding rather than manual wiring.
- We keep Fastify under the hood, so the raw-response SSE streaming (hijack + manual
  framing) continues to work via `@Res()`; Nest's `@Sse()` Observable abstraction is
  not used because our event framing is custom.
- Scope is deliberately bounded to modules + DI. No microservices, no CQRS; those
  would be overkill for a single-service personal app.
- The rewrite has a real cost: existing routes, the SSE hijack, and provider wiring
  must be ported. We pay it now because the backend is already being substantially
  rewritten for the server-side Workspace and agentic loop (ADRs 0001, 0003), so the
  new work lands directly in Nest instead of being built twice.

## Alternatives considered

- **Stay on plain Fastify.** Rejected: no DI, and the structure was sprawling as the
  service grew.
- **NestJS on the Express adapter (the default).** Viable, but we would re-derive the
  raw SSE handling on Express and give up Fastify's speed for no gain, given our code
  is already Fastify-shaped.
