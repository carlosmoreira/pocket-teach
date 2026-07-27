import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  ChatEvent,
  LessonPlan,
  TeachMeta,
} from '@pocket-teach/api-types';
import type {
  ChatArgs,
  LLMProvider,
  PlanArgs,
  ProviderCapabilities,
  WriteArgs,
  WriteResult,
} from './LLMProvider.js';

const BASE_CSS = readFileSync(
  fileURLToPath(new URL('../style/base.css', import.meta.url)),
  'utf8',
);

export class ClaudeProvider implements LLMProvider {
  readonly id = 'claude';
  readonly capabilities: ProviderCapabilities = {
    webSearch: true,
    promptCache: true,
  };

  constructor(
    private readonly models: { planner: string; writer: string } = {
      planner: 'claude-sonnet-5',
      writer: 'claude-sonnet-5',
    },
  ) {}

  // TODO(chunk-2): call the planner model via the AI SDK (generateObject) with
  // web_search grounding; return the real LessonPlan.
  async plan(args: PlanArgs): Promise<LessonPlan> {
    // this.models.{planner,writer} are wired into the real AI-SDK calls in chunk 2.
    void this.models;
    const topic = args.topic?.trim() || 'your topic';
    return {
      objective: `Understand the core idea behind ${topic} well enough to explain it in one sentence.`,
      zpdNote:
        'Learner is new to this area; start from first principles, one concept at a time.',
      knowledgePoints: [
        'What problem this idea solves',
        'The single mental model that unlocks it',
        'One worked example end to end',
      ],
      primarySource: {
        title: 'Canned high-trust source (stub)',
        url: 'https://example.com/primary-source',
      },
      quizConcept: 'Recognising the core mental model in a new example',
      glossaryIntroduced: [
        {
          term: 'Mental model',
          definition:
            'A compact internal representation that lets you predict how something behaves.',
        },
      ],
      glossaryUpdates: [],
      resourceUpdates: [
        {
          title: 'Canned resource (stub)',
          url: 'https://example.com/resource',
          note: 'Replaced by real grounded resources in chunk 2.',
        },
      ],
      referenceDoc: undefined,
    };
  }

  // TODO(chunk-2): call the writer model via the AI SDK (streamText); return the
  // real HTML + parse/validate its #teach-meta island (with one repair retry).
  async write(args: WriteArgs): Promise<WriteResult> {
    const { plan } = args;
    const slug = '0001-getting-started';
    const title = 'Getting started (stub lesson)';

    const meta: TeachMeta = {
      title,
      slug,
      primarySource: plan.primarySource,
      linkedTerms: plan.glossaryIntroduced.map((g) => g.term),
      recap: `A stub lesson introducing: ${plan.objective}`,
      glossaryUpdates: plan.glossaryIntroduced,
      resourceUpdates: plan.resourceUpdates,
    };

    const html = renderLessonHtml(title, plan, meta);
    return { html, meta };
  }

  // TODO(chunk-2): stream real teacher text from the chat model and drive the
  // read_lesson tool-loop / <proposal> / <record> islands.
  async *chat(_args: ChatArgs): AsyncIterable<ChatEvent> {
    const sentences = [
      'Great question. ',
      'Here is a stubbed teacher answer grounded in your workspace. ',
      'In chunk 2 this streams from the real chat model.',
    ];
    for (const delta of sentences) {
      yield { type: 'message', delta };
    }
    yield {
      type: 'proposal',
      proposal: {
        objective: 'A follow-up lesson the teacher might suggest.',
        rationale: 'Stub rationale — replaced by real reasoning in chunk 2.',
      },
    };
    // TODO(chunk-2): when the model needs a lesson verbatim, emit
    //   { type: 'tool_call', call: { tool: 'read_lesson', slug } }
    // and let the app answer from Dexie, then re-invoke /chat.
    yield { type: 'done' };
  }
}

function renderLessonHtml(
  title: string,
  plan: LessonPlan,
  meta: TeachMeta,
): string {
  const knowledge = plan.knowledgePoints
    .map((p) => `      <li>${escapeHtml(p)}</li>`)
    .join('\n');

  // Options kept equal-ish length per the /teach quiz rule.
  const options = [
    { text: 'A predictive model', correct: true },
    { text: 'A random guesser', correct: false },
    { text: 'A lookup table.', correct: false },
  ];
  const optionButtons = options
    .map(
      (o, i) =>
        `        <button type="button" class="pt-quiz__option" data-correct="${o.correct}" data-i="${i}">${escapeHtml(
          o.text,
        )}</button>`,
    )
    .join('\n');

  const metaJson = JSON.stringify(meta, null, 2);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${BASE_CSS}
</style>
</head>
<body>
<article>
  <h1>${escapeHtml(title)}</h1>
  <p class="pt-objective">${escapeHtml(plan.objective)}</p>

  <h2>What you'll learn</h2>
  <ul>
${knowledge}
  </ul>

  <p>This is a <strong>stubbed lesson</strong> produced by the chunk-1 gateway.
  The real writer model will replace this body with grounded prose, a worked
  example, and cross-links — while keeping this exact document shape.</p>

  <section class="pt-quiz" aria-label="Quiz">
    <p class="pt-quiz__q">${escapeHtml(plan.quizConcept)}: which best describes the core mental model?</p>
    <div class="pt-quiz__options">
${optionButtons}
    </div>
    <p class="pt-quiz__feedback" role="status" aria-live="polite"></p>
  </section>

  <p class="pt-source">Primary source:
    <a href="${escapeAttr(plan.primarySource.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(
      plan.primarySource.title,
    )}</a>
  </p>
</article>

<script type="application/json" id="teach-meta">
${metaJson}
</script>

<script>
  // Runs inside the sandboxed iframe, so keep it self-contained.
  (function () {
    var quiz = document.querySelector('.pt-quiz');
    if (!quiz) return;
    var feedback = quiz.querySelector('.pt-quiz__feedback');
    var options = quiz.querySelectorAll('.pt-quiz__option');
    options.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var correct = btn.getAttribute('data-correct') === 'true';
        options.forEach(function (b) {
          b.setAttribute('aria-disabled', 'true');
          if (b.getAttribute('data-correct') === 'true') b.classList.add('is-correct');
        });
        if (!correct) btn.classList.add('is-wrong');
        feedback.textContent = correct
          ? 'Correct — that is the mental model.'
          : 'Not quite. The highlighted option is the mental model.';
        feedback.className =
          'pt-quiz__feedback ' + (correct ? 'is-correct' : 'is-wrong');
      });
    });
  })();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
