# Pocket Teach — Domain Glossary

The ubiquitous language for Pocket Teach. Terms here are canonical: code, prompts,
and conversation should use these words with these meanings. This file is a glossary
only — no implementation details, no decisions (those live in `docs/adr/`).

## Actors

**Learner** — the single human using the app. Pocket Teach is personal and
single-user; there is no notion of multiple accounts or tenants.

**Teacher** — the AI acting as a mentor. The Teacher is a _role_, not a model: it
interviews the Learner, grounds itself in trusted sources, authors Lessons, answers
questions, and curates its own memory. "The model" or "the Provider" is the
substrate the Teacher runs on; they are not the same thing.

## The learning journey

**Project** — one learning journey: a subject the Learner is pursuing, with its own
Mission, Lessons, and Teacher memory. The Learner may have several Projects. Each
Project is backed by exactly one Workspace.

**Mission** — why the Learner is here for a given Project: their goal, their real
reason ("why"), what success looks like, and their constraints (e.g. time). The
Mission grounds every decision the Teacher makes. It is elicited conversationally
during onboarding, not via a form.

**Roadmap** — the Teacher's running plan of what to teach next in a Project, and what
has already been taught. It persists across sessions so the Teacher never loses the
thread of a long journey.

## What the Teacher produces

**Lesson** — a single, self-contained HTML document that teaches one tightly-scoped
idea and ends with a short interactive quiz. Lessons are the only artifact the Learner
reads offline. Each Lesson keeps a stable Slug across regenerations.

**Slug** — a Lesson's stable identifier, e.g. `0003-borrowing`. Cross-lesson links
target Slugs; an Amplify keeps the Slug so links never break.

**Recap** — a one-to-three-sentence summary of a Lesson. Recaps form the cross-lesson
index the Teacher reads to reason about the whole Project without loading every
Lesson body.

**Reference doc** — a reusable quick-reference (syntax table, checklist, cheat sheet)
the Teacher may create alongside Lessons. Distinct from a Lesson: not a taught unit
but a look-up surface.

## The Teacher's memory

**Learner profile** — the Teacher's durable understanding of the Learner: what they
already know, their background, and how they learn best. This is the memory that
makes teaching adaptive.

**Learning record** — a single durable insight captured when the Learner demonstrates
understanding, reveals prior knowledge, or corrects a misconception. Learning records
accumulate into the Learner profile. A plain question earns no record.

**Misconception** — a specific error the Learner made and corrected, kept so the
Teacher can revisit it. A negative-space counterpart to a Learning record.

**Subject glossary** — the terms of the _Learner's subject_ (e.g. "borrow checker"),
curated by the Teacher for one Project. Not to be confused with _this_ file, which is
the glossary of _our_ codebase domain.

## How the Teacher works

**Workspace** — the complete set of files that constitute one Project: its Mission,
Roadmap, Learner profile, Subject glossary, Lessons, Learning records, and transcript.
The Teacher reads and writes the Workspace to do its work. (Where the Workspace lives,
and what the Learner's device keeps, are settled in ADR 0001.)

**Agentic loop** — the bounded, multi-step run in which the Teacher pursues one goal
(answer a question, or author a Lesson) by calling Tools until done, deciding the
steps itself rather than following a fixed pipeline.

**Tool** — a capability the Teacher may invoke inside the loop: reading and writing
Workspace files, searching and fetching the web, or offering a Proposal. Tools are
the only way the Teacher affects the world; prose alone changes nothing.

**Grounding** — the discipline of teaching only from high-trust sources found by web
search, never from the model's parametric memory. Every Lesson names one Primary
source.

**Primary source** — the single most trustworthy resource behind a Lesson, captured
as an exact title and URL.

**Proposal** — the Teacher's offer to act, which the Learner confirms before anything
runs. A Proposal is either a **new-lesson** (create the next Lesson) or an **amplify**
(clarify an existing Lesson in place). Nothing is generated until the Learner accepts,
by tapping the confirm card or agreeing in chat.

**Amplify** — regenerating an existing Lesson to be clearer, keeping its objective and
Slug; only the explanation changes.

## Backends behind seams

**Provider** — an LLM backend the Teacher runs on. Claude today; swappable to a local
model (e.g. Ollama) without changing the Teacher. Chosen by configuration.

**Search provider** — a web-grounding backend. Anthropic's native web tools today;
swappable to a standalone search API when the Provider has no built-in search.
