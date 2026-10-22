// Browser verification of boot sequence, request order, and loading handoff
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

if (!process.env.PLAYWRIGHT_MODULE || !process.env.CHROMIUM_EXECUTABLE) {
  console.warn(
    '[check-boot-order] PLAYWRIGHT_MODULE or CHROMIUM_EXECUTABLE not set. ' +
      'Skipping browser check (required reviewer gate on device/browser).'
  );
  process.exit(0);
}

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE,
});

const BASE_URL = process.env.APP_URL || 'http://127.0.0.1:5173';

try {
  console.log('[check-boot-order] Starting browser boot order checks at', BASE_URL);

  // 1. Normal cold start request order check
  {
    console.log('[check-boot-order] 1. Checking normal cold start request order...');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    const requestLog = [];
    page.on('request', (req) => {
      requestLog.push({ url: req.url(), time: Date.now() });
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

    // Assert intro is displayed first
    const initialBootState = await page.evaluate(
      () => document.body.dataset.bootState
    );
    assert.equal(initialBootState, 'intro', 'Initial boot state must be intro');

    // The Alpaca intro remains visible while the game module and fonts prepare.
    await page.waitForFunction(() => document.body.dataset.bootState === 'preparing', undefined, {
      timeout: 10000,
    });
    const preparingTime = Date.now();
    assert.equal(await page.locator('#intro').isVisible(), true);
    assert.equal(await page.locator('#loading-shell').count(), 0);

    // The game module starts after the intro hold, while the intro covers setup.
    await page.waitForFunction(
      () => performance.getEntriesByType('resource').some((entry) => entry.name.includes('/src/main.ts')),
      undefined,
      { timeout: 15000 }
    );
    const mainReq = requestLog.find((r) => r.url.includes('/src/main.ts'));
    assert.ok(mainReq, 'main.ts should be requested');
    assert.ok(
      mainReq.time >= preparingTime - 200,
      'main.ts should only be requested after the intro hold'
    );

    // The intro leaves only after Phaser's real LoadingScene has rendered.
    await page.waitForFunction(() => document.body.dataset.bootState === 'loading', undefined, {
      timeout: 15000,
    });
    const loadingTime = Date.now();
    assert.equal(await page.locator('#intro').isVisible(), false);

    // Wait a moment for galaxy loads
    await page.waitForTimeout(1000);
    const galaxyReqs = requestLog.filter((r) => r.url.includes('/galaxies/'));
    for (const gReq of galaxyReqs) {
      assert.ok(
        gReq.time >= loadingTime - 200,
        `Galaxy art ${gReq.url} should only be requested after the real loading frame`
      );
    }

    await context.close();
  }

  // 2. Tap skip check
  {
    console.log('[check-boot-order] 2. Checking tap skip...');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const start = Date.now();

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#intro', { state: 'visible' });

    // Tap intro after 300ms
    await page.waitForTimeout(300);
    await page.click('#intro');

    await page.waitForFunction(() => document.body.dataset.bootState === 'preparing', undefined, {
      timeout: 3000,
    });
    const elapsed = Date.now() - start;
    assert.ok(
      elapsed < 3000,
      `Tap skip should start preparing within 3s, took ${elapsed}ms`
    );

    await context.close();
  }

  // 3. Reduced motion check
  {
    console.log('[check-boot-order] 3. Checking reduced motion...');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const start = Date.now();

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.bootState === 'preparing', undefined, {
      timeout: 2500,
    });
    const elapsed = Date.now() - start;
    assert.ok(
      elapsed < 2000,
      `Reduced motion should start preparing within 2s, took ${elapsed}ms`
    );

    await context.close();
  }

  // 4. Wide viewport check
  {
    console.log('[check-boot-order] 4. Checking wide viewport (1920x1080)...');
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/?skipSplash=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.bootState === 'ready', undefined, {
      timeout: 10000,
    });
    await context.close();
  }

  // 5. Dev direct entry check
  {
    console.log('[check-boot-order] 5. Checking dev direct entry...');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/?scene=play&level=1-1&mode=harness`, {
      waitUntil: 'domcontentloaded',
    });

    const introVisible = await page.evaluate(() => {
      const el = document.getElementById('intro');
      return el && window.getComputedStyle(el).display !== 'none';
    });
    assert.ok(!introVisible, 'Intro must be hidden on direct dev entry');
    await context.close();
  }

  // 6. Retry on module import failure
  {
    console.log('[check-boot-order] 6. Checking retry on module load failure...');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    let failOnce = true;
    await page.route('**/src/main.ts*', (route) => {
      if (failOnce) {
        failOnce = false;
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    // Click intro to speed up
    await page.waitForSelector('#intro', { state: 'visible' });
    await page.click('#intro');

    // A failed import keeps the Alpaca intro visible with a retry control.
    await page.waitForSelector('.intro-error', { state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('#intro').isVisible(), true);

    // Click retry button
    await page.click('.intro-retry-btn');

    // Should load successfully and reveal the real loading scene
    await page.waitForFunction(() => document.body.dataset.bootState === 'loading', undefined, {
      timeout: 15000,
    });

    await context.close();
  }

  console.log('[check-boot-order] All checks passed successfully!');
} finally {
  await browser.close();
}
