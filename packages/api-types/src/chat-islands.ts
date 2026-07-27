import {
  ProposalSchema,
  LearningRecordNoteSchema,
  type Proposal,
  type LearningRecordNote,
} from './islands.js';

export type ProposalIslandResult =
  | { ok: true; proposal: Proposal }
  | { ok: false; error: string };

export type RecordIslandResult =
  | { ok: true; record: LearningRecordNote }
  | { ok: false; error: string };

const PROPOSAL_RE =
  /<script[^>]*\bid=["']proposal["'][^>]*>([\s\S]*?)<\/script>/i;
const RECORD_RE = /<script[^>]*\bid=["']record["'][^>]*>([\s\S]*?)<\/script>/i;

export function extractProposal(text: string): ProposalIslandResult {
  const rawJson = PROPOSAL_RE.exec(text)?.[1];
  if (rawJson === undefined) {
    return { ok: false, error: 'no #proposal island found in text' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson.trim());
  } catch {
    return { ok: false, error: 'invalid JSON inside #proposal island' };
  }

  const result = ProposalSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `#proposal failed validation: ${result.error.message}`,
    };
  }
  return { ok: true, proposal: result.data };
}

export function extractRecord(text: string): RecordIslandResult {
  const rawJson = RECORD_RE.exec(text)?.[1];
  if (rawJson === undefined) {
    return { ok: false, error: 'no #record island found in text' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson.trim());
  } catch {
    return { ok: false, error: 'invalid JSON inside #record island' };
  }

  const result = LearningRecordNoteSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `#record failed validation: ${result.error.message}`,
    };
  }
  return { ok: true, record: result.data };
}
