/**
 * Moves files with `git mv` and rewrites every relative import, quoted `/src/...`
 * string and html `src=` attribute that pointed at them.
 *
 * Usage: node --experimental-strip-types scripts/dev/move-files.ts [--dry] <from> <to> [<from> <to> ...]
 * `from` may be a file or a folder (moved with its whole tree); `to` is the new path.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const SPECIFIER =
  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bvi\.(?:mock|doMock|unmock)\s*\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g;
const ROOTED = /(['"])\/(src\/[^'"]+)\1/g;

export function rewriteImports(
  text: string,
  oldFile: string,
  newFile: string,
  moved: ReadonlyMap<string, string>
): string {
  const withRelative = text.replace(SPECIFIER, (whole: string, lead: string, quote: string, spec: string) => {
    const old = posix.join(posix.dirname(oldFile), spec);
    const target = moved.get(old) ?? old;
    let next = posix.relative(posix.dirname(newFile), target);
    if (!next.startsWith('.')) next = `./${next}`;
    return next === spec ? whole : `${lead}${quote}${next}${quote}`;
  });
  return withRelative.replace(ROOTED, (whole: string, quote: string, path: string) => {
    const next = moved.get(path);
    return next ? `${quote}/${next}${quote}` : whole;
  });
}

const SCAN_ROOTS = ['src', 'tests', 'scripts', 'tools'];
const SCAN_FILES = ['index.html', 'vite.config.ts', 'capacitor.config.ts'];
const SCAN_EXT = /\.(ts|mjs|html)$/;

const normalize = (path: string): string => path.replaceAll('\\', '/').replace(/\/+$/, '');

function listFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => listFiles(posix.join(path, name)));
}

function scanFiles(): string[] {
  const inRoots = SCAN_ROOTS.filter((root) => existsSync(root))
    .flatMap((root) => listFiles(root))
    .filter((file) => SCAN_EXT.test(file));
  return [...inRoots, ...SCAN_FILES.filter((file) => existsSync(file))];
}

function main(argv: string[]): void {
  const dry = argv.includes('--dry');
  const args = argv.filter((arg) => arg !== '--dry');
  if (args.length === 0 || args.length % 2 !== 0) {
    console.error('usage: move-files.ts [--dry] <from> <to> [<from> <to> ...]');
    process.exit(1);
  }

  const moved = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const from = normalize(args[i]);
    const to = normalize(args[i + 1]);
    for (const file of listFiles(from)) {
      const target = file === from ? to : posix.join(to, posix.relative(from, file));
      if (existsSync(target)) throw new Error(`destination already exists: ${target}`);
      moved.set(file, target);
    }
  }

  if (dry) {
    for (const [from, to] of moved) console.log(`${from} -> ${to}`);
    return;
  }

  const rewrites: Array<{ to: string; text: string }> = [];
  for (const file of scanFiles()) {
    const text = readFileSync(file, 'utf8');
    const target = moved.get(file) ?? file;
    const next = rewriteImports(text, file, target, moved);
    if (next !== text) rewrites.push({ to: target, text: next });
  }

  for (const [from, to] of moved) {
    mkdirSync(posix.dirname(to), { recursive: true });
    execFileSync('git', ['mv', from, to], { stdio: 'inherit' });
  }
  for (const { to, text } of rewrites) writeFileSync(to, text);
  console.log(`moved ${moved.size} file(s), rewrote ${rewrites.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
