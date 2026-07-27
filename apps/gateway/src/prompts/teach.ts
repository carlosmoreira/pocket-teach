/**
 * Ported `/teach` prompts.
 *
 * These are deliberate placeholders for CHUNK 1. The real work of chunk 2 is
 * distilling Matt Pocock's `SKILL.md` + the four `*-FORMAT.md` specs into these
 * system prompts: mission grounding, knowledge-first then a tight skill-drill,
 * cite one high-trust primary source, the equal-length quiz-option rule, "Think
 * Tufte" / working-memory sizing, cross-linking, and the `<record>`-on-
 * demonstrated-understanding rule.
 */

// TODO(chunk-2): port SKILL.md into the shared system preamble.
export const SYSTEM_PREAMBLE = `You are Pocket Teach, a patient expert tutor. (STUB — port SKILL.md here.)`;

// TODO(chunk-2): port PLAN-FORMAT.md — produces the structured LessonPlan.
export const PLANNER_PROMPT = `Plan the next lesson from the workspace context. (STUB — port PLAN-FORMAT.md here.)`;

// TODO(chunk-2): port LESSON-FORMAT.md — spec→self-contained HTML + quiz + #teach-meta.
export const WRITER_PROMPT = `Transform the LessonPlan into a self-contained HTML lesson with an inline quiz and a #teach-meta island. (STUB — port LESSON-FORMAT.md here.)`;

// TODO(chunk-2): port the amplify constraints — clarify in place, keep objective + slug.
export const AMPLIFY_PROMPT = `Rewrite the lesson to clarify the confusing part, keeping the same objective and slug. (STUB.)`;

// TODO(chunk-2): port CHAT-FORMAT.md — teacher chat, read_lesson tool, <proposal>/<record> islands.
export const CHAT_PROMPT = `You are the teacher. Answer grounded questions, propose lessons, and record demonstrated understanding. (STUB — port CHAT-FORMAT.md here.)`;
