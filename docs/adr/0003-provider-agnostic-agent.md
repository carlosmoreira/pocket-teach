# 3. Provider-agnostic agentic loop, not a hosted agent

Status: accepted

## Context

The Teacher's methodology (`/teach`) is naturally an agent operating on a filesystem:
research, write files, remember, revisit. Anthropic's Managed Agents would give us
that directly — a hosted, stateful agent with a container, filesystem, and Skills — and
would remove most of our orchestration code.

But a Learner goal is to eventually run the Teacher on a local model (e.g. Ollama).
Managed Agents are Anthropic-only.

## Decision

Build the Teacher as a provider-agnostic agentic loop: a bounded multi-step tool loop
via the Vercel AI SDK, with Tools we implement against our own Workspace and Providers.
Do not adopt Anthropic Managed Agents.

The agentic loop also replaces the fixed two-step planner→writer generation. That split
existed only to dodge Anthropic's "structured output cannot co-exist with web search"
constraint; since the Teacher emits Lessons through Tools rather than structured-output
calls, the constraint — and the split — disappear.

## Consequences

- The loop mechanics run against any AI-SDK Provider, keeping the local-model door
  open.
- The one Anthropic-specific dependency is web search; grounding moves behind the
  Search provider seam so switching Providers is a configuration change plus a Search
  provider swap, not a rewrite.
- We own the agent loop, the Tool registry, and Workspace persistence (see ADR 0001)
  rather than delegating them to a hosted runtime.
- "Agentic" means more autonomous, not faster: runs may take more model turns. This is
  a quality/simplicity choice, not a latency one.

## Alternatives considered

- **Anthropic Managed Agents.** Rejected: provider lock-in conflicts with the
  local-model goal, despite being the closest fit to `/teach`.
- **Keep the fixed planner→writer pipeline.** Rejected: rigid, can't adapt research
  depth, and only existed to work around a constraint the Tool-based approach removes.
