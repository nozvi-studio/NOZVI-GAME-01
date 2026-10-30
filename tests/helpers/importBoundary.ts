import { dirname, resolve, sep } from 'node:path';

export type SourceFile = { path: string; text: string };

/** `from '…'`, `import '…'` and `import('…')` with a relative specifier. */
const RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\1/g;

/** Relative imports in `files` that resolve outside every folder in `allowedRoots`. */
export function findEscapes(files: readonly SourceFile[], allowedRoots: readonly string[]): string[] {
  const roots = allowedRoots.map((root) => resolve(root));
  const offenders: string[] = [];
  for (const file of files) {
    for (const match of file.text.matchAll(RELATIVE_IMPORT)) {
      const target = resolve(dirname(file.path), match[2]);
      const inside = roots.some((root) => target === root || target.startsWith(root + sep));
      if (!inside) offenders.push(`${file.path} -> ${match[2]}`);
    }
  }
  return offenders;
}
