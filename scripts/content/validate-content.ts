import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { campaignManifest } from '../../src/content/manifest.ts';
import { validateLevel } from '../../src/content/validate.ts';
import { makeAdjacentFixture } from '../../src/content/fixtures.ts';
import { releaseBlocker, searchSolutions } from '../../src/content/authoringReport.ts';
import type { LevelDocument } from '../../src/content/document.ts';
import { releaseGate } from '../../src/content/chapters.ts';

const isReleaseMode = process.argv.includes('--release');

console.log(`[validate-content] Running in ${isReleaseMode ? 'RELEASE' : 'DEVELOPMENT'} mode...`);

// 1. Luôn kiểm tra fixture kỹ thuật M0
const fixture = makeAdjacentFixture();
const fixtureRes = validateLevel(fixture);
if (!fixtureRes.ok) {
  console.error('[validate-content] FAIL: Technical fixture validation failed:', fixtureRes.issues);
  process.exit(1);
}
console.log(`[validate-content] PASS: Technical fixture '${fixture.id}' is valid.`);

// 2. Kiểm tra các entry trong manifest có dataPath
let validatedCount = 0;
for (const entry of campaignManifest) {
  if (entry.dataPath) {
    const fullPath = resolve(process.cwd(), entry.dataPath);
    if (!existsSync(fullPath)) {
      console.error(`[validate-content] FAIL: File not found for ${entry.id} at ${entry.dataPath}`);
      process.exit(1);
    }
    const raw = JSON.parse(readFileSync(fullPath, 'utf-8'));
    const res = validateLevel(raw);
    if (!res.ok) {
      console.error(`[validate-content] FAIL: Level ${entry.id} invalid:`, res.issues);
      process.exit(1);
    }
    // Release: bộ giải phải chứng minh nghiệm duy nhất, trừ khi người review ghi allowUnproven (FP-09)
    if (isReleaseMode) {
      const doc = raw as LevelDocument;
      const blocker = releaseBlocker(doc, searchSolutions(doc));
      if (blocker) {
        console.error(
          `[validate-content] FAIL: Level ${entry.id} ${blocker}: chưa chứng minh được nghiệm duy nhất; ` +
            'cần ghi allowUnproven kèm lý do vào nguồn.'
        );
        process.exit(1);
      }
    }
    validatedCount++;
    console.log(`[validate-content] PASS: Level ${entry.id} (${entry.title}) validated.`);
  }
}

// 3. Release mode: cần đủ RELEASE_LEVEL_COUNT (28) màn 'approved' (CH-04)
if (isReleaseMode) {
  const gate = releaseGate(campaignManifest);
  if (!gate.ok) {
    console.error(
      `[validate-content] GATE FAIL: campaign-incomplete. Required ${gate.required} approved levels, found ${gate.approved}.`
    );
    process.exit(1);
  }
}

console.log(`[validate-content] ALL CHECKS PASSED. (${validatedCount} authored levels checked)`);
