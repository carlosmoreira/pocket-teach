import { BASE_CSS } from './base-css';

// The Teacher authors only the lesson body (using the pt- classes); the app owns
// the document shell, viewport, and canonical stylesheet so every lesson renders
// as one book inside the sandboxed iframe.
export function wrapLesson(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${BASE_CSS}</style>
</head>
<body>
<main>
${bodyHtml.trim()}
</main>
</body>
</html>`;
}
