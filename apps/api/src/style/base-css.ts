import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Read once at load. The writer inlines this verbatim into every lesson so the
// whole course renders as one book — self-contained inside the sandboxed iframe.
export const BASE_CSS = readFileSync(fileURLToPath(new URL('./base.css', import.meta.url)), 'utf8');
