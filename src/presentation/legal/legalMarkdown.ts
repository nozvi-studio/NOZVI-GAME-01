import { openExternal } from '../openExternal.ts';

function httpsUrl(value: string): boolean {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

/** Deliberately small Markdown subset. Source text is never interpreted as HTML. */
function inline(parent: HTMLElement, source: string, doc: Document): void {
  const tokens = /\[([^\]]+)\]\(([^\s)]+)\)|\*\*(.+?)\*\*|__(.+?)__|\*([^*]+)\*|_([^_]+)_/g;
  let start = 0;
  const literal = (value: string): void => {
    if (!value) return;
    const span = doc.createElement('span');
    span.textContent = value;
    parent.append(span);
  };
  for (const match of source.matchAll(tokens)) {
    literal(source.slice(start, match.index));
    if (match[1] !== undefined) {
      if (httpsUrl(match[2])) {
        const link = doc.createElement('a');
        link.textContent = match[1];
        link.href = match[2];
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.addEventListener('click', event => { event.preventDefault(); openExternal(match[2]); });
        parent.append(link);
      } else literal(match[0]);
    } else {
      const strong = match[3] ?? match[4];
      const el = doc.createElement(strong !== undefined ? 'strong' : 'em');
      inline(el, strong ?? match[5] ?? match[6], doc);
      parent.append(el);
    }
    start = match.index! + match[0].length;
  }
  literal(source.slice(start));
}

const cells = (line: string): string[] => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
const tableRule = (line: string): boolean => line.includes('|') && cells(line).every(c => /^:?-{3,}:?$/.test(c));
const bullet = /^\s*[-*+]\s+/;
const heading = /^(#{1,6})\s+(.+)$/;

export function renderLegalMarkdown(markdown: string, doc: Document = document): HTMLElement {
  const root = doc.createElement('div');
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const title = heading.exec(line);
    if (title) {
      const el = doc.createElement(`h${title[1].length}` as 'h1');
      inline(el, title[2], doc);
      root.append(el);
      i++;
    } else if (i + 1 < lines.length && line.includes('|') && tableRule(lines[i + 1])) {
      const scroll = doc.createElement('div');
      scroll.style.cssText = 'max-width:100%;overflow-x:auto;';
      // Keyboard users can scroll a wide table as well as read its cells.
      scroll.tabIndex = 0;
      const table = doc.createElement('table');
      const head = doc.createElement('thead');
      const body = doc.createElement('tbody');
      const row = (values: string[], tag: 'th' | 'td'): HTMLElement => {
        const tr = doc.createElement('tr');
        for (const value of values) {
          const cell = doc.createElement(tag);
          if (tag === 'th') cell.setAttribute('scope', 'col');
          inline(cell, value, doc);
          tr.append(cell);
        }
        return tr;
      };
      head.append(row(cells(line), 'th'));
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) body.append(row(cells(lines[i++]), 'td'));
      table.append(head, body);
      scroll.append(table);
      root.append(scroll);
    } else if (bullet.test(line)) {
      const list = doc.createElement('ul');
      while (i < lines.length && bullet.test(lines[i])) {
        const item = doc.createElement('li');
        inline(item, lines[i++].replace(bullet, ''), doc);
        list.append(item);
      }
      root.append(list);
    } else {
      const paragraph = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !heading.test(lines[i]) && !bullet.test(lines[i]) &&
        !(i + 1 < lines.length && tableRule(lines[i + 1]))) paragraph.push(lines[i++].trim());
      const p = doc.createElement('p');
      inline(p, paragraph.join(' '), doc);
      root.append(p);
    }
  }
  return root;
}
