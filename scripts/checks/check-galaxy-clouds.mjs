import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/');
  const results = await page.evaluate(async () => {
    const results = [];
    for (const layer of ['A', 'B']) {
      const image = new Image();
      image.src = `/assets/galaxies/dwarf-cloud${layer}.svg`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, 1024, 1024);
      let maxJump = 0;
      let location = null;
      for (let y = 1; y < 1024; y++) for (let x = 1; x < 1024; x++) {
        const alpha = data[(y * 1024 + x) * 4 + 3];
        const jump = Math.max(Math.abs(alpha - data[(y * 1024 + x - 1) * 4 + 3]), Math.abs(alpha - data[((y - 1) * 1024 + x) * 4 + 3]));
        if (jump > maxJump) { maxJump = jump; location = [x, y]; }
      }
      results.push({ layer, maxJump, location });
    }
    return results;
  });
  console.log(JSON.stringify(results));
  for (const result of results) assert.ok(result.maxJump <= 4, `Cloud ${result.layer} contains a hard alpha edge: ${result.maxJump} at ${result.location}`);
} finally { await browser.close(); }
