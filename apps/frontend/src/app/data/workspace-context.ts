import type { LearningRecord, Lesson, Project } from './models';

export function buildContextMarkdown(
  project: Project,
  lessons: Lesson[],
  records: LearningRecord[],
): string {
  const m = project.mission;
  const mission = [`# Mission`, `Topic: ${m.topic}`];
  if (m.why) mission.push(`Why: ${m.why}`);
  if (m.successLooksLike) mission.push(`Success looks like: ${m.successLooksLike}`);
  if (m.constraints) mission.push(`Constraints: ${m.constraints}`);

  const sections = [mission.join('\n')];

  if (project.glossary.length) {
    sections.push(
      ['# Glossary', ...project.glossary.map((g) => `- ${g.term}: ${g.definition}`)].join('\n'),
    );
  }

  if (project.resources.length) {
    sections.push(
      ['# Resources', ...project.resources.map((r) => `- ${r.title} — ${r.url}`)].join('\n'),
    );
  }

  if (records.length) {
    sections.push(['# Learning records', ...records.map((r) => `- ${r.note}`)].join('\n'));
  }

  const index = lessons.length
    ? lessons.map((l) => `- ${l.slug} · ${l.title}\n  Recap: ${l.recap}`)
    : ['(no lessons yet)'];
  sections.push(['# Lesson index', ...index].join('\n'));

  return sections.join('\n\n');
}
