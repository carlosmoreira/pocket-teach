import type { ChatEvent, Proposal, ProposalKind, StoredMessage } from '@pocket-teach/api-types';

export type { ChatEvent, Proposal, ProposalKind, StoredMessage };

export type EmitChat = (event: ChatEvent) => void;
