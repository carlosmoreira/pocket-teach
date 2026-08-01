export type ProposalKind = 'new_lesson' | 'amplify';

// The Teacher's offer to act, surfaced to the client as a confirm card.
export interface Proposal {
  kind: ProposalKind;
  objective: string;
  rationale: string;
  targetSlug?: string;
  focus?: string;
  confirmed?: boolean;
}

// Streamed to the client over SSE during a chat turn.
export type ChatEvent =
  | { type: 'message'; delta: string }
  | { type: 'proposal'; proposal: Proposal }
  | { type: 'record'; note: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type EmitChat = (event: ChatEvent) => void;

// One turn as persisted in the workspace transcript.
export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  proposal?: Proposal;
  at: string;
}
