# 1. Server-side git-backed Workspace as source of truth

Status: accepted

## Context

The original design made the Learner's device the source of truth: all Project data
lived in the browser (IndexedDB), the backend was a thin stateless gateway, and the
device shipped its state up on every request. That fit an offline-first, own-your-data
goal.

We are moving the Teacher to an agentic model (see ADR 0003), where it reads and
writes a Workspace of Markdown/HTML files directly during a run. Keeping those files
on the device would mean serializing the whole Workspace up on every turn and running
the Teacher's file Tools as round-trips back to the client — reimplementing a
server-side filesystem awkwardly over the wire.

The app is personal and runs on the Learner's own machine (later a home lab), never as
a hosted service.

## Decision

The Workspace lives on the backend's local disk, one directory per Project, and is the
source of truth. The Teacher reads and writes it directly. Each Workspace is a git
repository; the Teacher commits after meaningful changes.

The device holds only a replica of Lessons, synced after generation, so lesson reading
works offline. Everything else (Mission, Roadmap, Learner profile, transcript) is
fetched when online.

## Consequences

- The backend is now stateful. It needs a persistent volume for the Workspace root.
- Durability is local: git history gives undo and rollback of memory files; ordinary
  machine/NAS backups of the Workspace directory cover disaster recovery. No cloud
  storage or paid service. Losing the disk without a backup loses Teacher memory
  (Lessons survive on the device replica).
- Offline reach shrinks to Lessons only. Reviewing Roadmap/memory or chatting needs
  the backend, which those activities always required anyway.
- Multi-device gets easier: several devices hitting one backend share one memory.
- The git-per-Project format is a natural bridge to importing a desktop `/teach`
  folder later.

## Alternatives considered

- **Device as source of truth (status quo).** Rejected: fights the agentic file model
  and forces per-Tool round-trips and full-Workspace uploads.
- **Cloud object storage (e.g. S3).** Rejected: adds a paid dependency for a personal,
  single-user, home-lab app.
