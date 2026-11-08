/**
 * Checks that the bundled legal text (legal/*.md, the offline fallback shown in the game)
 * says the same thing as the public web pages the game opens when online.
 * Usage: npm run legal:check
 * Compares words only (markup, links and table syntax ignored). Exits 1 on any difference.
 */
import { readFileSync } from 'node:fs';

const PAGES = {
  terms: 'https://dev.nozvi.pages.dev/term-of-service/',
  privacy: 'https://dev.nozvi.pages.dev/privacy-policy/',
} as const;
const LANGS = ['vi', 'en'] as const; // order of the <article> blocks on each page

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, code: string) => {
    if (code[0] === '#') return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

function words(text: string): string[] {
  return text.normalize('NFC').split(/\s+/).filter(Boolean);
}

function htmlWords(article: string): string[] {
  // Inline tags join their text to the neighbours; block tags separate words.
  const inline = /<\/?(?:strong|b|em|i|a|span|code)(?:\s[^>]*)?>/gi;
  return words(decode(article.replace(inline, '').replace(/<[^>]+>/g, ' ')));
}

function markdownWords(md: string): string[] {
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/).map(line => {
    if (/^\s*\|?\s*:?-{3,}/.test(line)) return '';        // table separator row
    if (/^#+\s/.test(line)) return line.replace(/^#+\s+/, '');
    return line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '');      // list markers
  });
  const text = lines.join('\n')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|\*/g, '')
    .replace(/\|/g, ' ');
  return words(text);
}

function firstDifference(a: string[], b: string[]): string | undefined {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      const around = (w: string[]) => w.slice(Math.max(0, i - 8), i + 8).join(' ');
      return `word ${i + 1}\n    bundled: …${around(a)}…\n    web:     …${around(b)}…`;
    }
  }
  return undefined;
}

let failed = false;
for (const [kind, url] of Object.entries(PAGES)) {
  const res = await fetch(url);
  if (!res.ok) { console.error(`✗ ${url}: HTTP ${res.status}`); failed = true; continue; }
  const articles = [...(await res.text()).matchAll(/<article class="legal-doc">([\s\S]*?)<\/article>/g)].map(m => m[1]);
  if (articles.length !== LANGS.length) { console.error(`✗ ${url}: expected ${LANGS.length} <article class="legal-doc">, found ${articles.length}`); failed = true; continue; }
  LANGS.forEach((lang, i) => {
    const file = `legal/${kind}.${lang}.md`;
    const diff = firstDifference(markdownWords(readFileSync(file, 'utf8')), htmlWords(articles[i]));
    if (diff) { console.error(`✗ ${file} differs from ${url} (${lang}) at ${diff}`); failed = true; }
    else console.log(`✓ ${file} matches ${url} (${lang})`);
  });
}
if (failed) {
  console.error('\nUpdate legal/*.md to match the web pages (or redeploy the site), then run again.');
  process.exit(1);
}
