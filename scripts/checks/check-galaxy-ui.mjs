// Run against a local dev server in an isolated browser profile.
// Set PLAYWRIGHT_MODULE to the installed playwright-core entry point.
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
const output = new URL('../../.shots/galaxy/', import.meta.url);
mkdirSync(output, { recursive: true });
const errors = [];
try {
  for (const { chapter, reduced, height } of [
    { chapter: 1, reduced: false, height: 844 },
    { chapter: 2, reduced: false, height: 844 },
    { chapter: 3, reduced: false, height: 844 },
    { chapter: 2, reduced: true, height: 690 },
  ]) {
    const label = `${chapter}${reduced ? '-reduced' : ''}`;
    const context = await browser.newContext({ viewport: { width: 390, height }, deviceScaleFactor: 2 });
    await context.addInitScript(({ chapter, reduced }) => {
      localStorage.setItem('nozvi.progress.v1', JSON.stringify({
        version: 1, campaignRevision: 'oracle-v1',
        completed: chapter === 3 ? [1,2,3].flatMap(ch => Array.from({length: ch === 3 ? 10 : 6}, (_, i) => `${ch}-${i+1}`)) : chapter === 2 ? ['1-1','1-2','1-3','1-4','1-5','1-6','2-1','2-2','2-3'] : ['1-1','1-2'],
        settings: { showTarget: true, reducedMotion: reduced, haptics: false, music: false, sfx: false },
      }));
    }, { chapter, reduced });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/?scene=menu');
    const waitScene = async key => {
      const deadline = Date.now() + 30000;
      let ready = false;
      while (Date.now() < deadline) {
        ready = await page.evaluate(async key => {
          const { director } = await import('/src/presentation/transitions/director.ts');
          const scene = director.host?.game.scene.getScene(key);
          return scene?.sys.settings.status === 5 && scene.scene.isActive() && !director.isTransitioning() && scene.input.enabled;
        }, key);
        if (ready) break;
        await page.waitForTimeout(100);
      }
      assert.ok(ready, `${key} ready for input`);
      const zoom = await page.evaluate(async key => {
        const { director } = await import('/src/presentation/transitions/director.ts');
        const game = director.host.game;
        const scene = game.scene.getScene(key);
        return { actual: scene.cameras.main.zoom, expected: game.scale.width / 720 };
      }, key);
      assert.ok(Math.abs(zoom.actual - zoom.expected) < 0.0001, `${key}: viewport zoom restored (${JSON.stringify(zoom)})`);
    };
    await waitScene('MenuScene');
    await page.waitForTimeout(1200);
    if (chapter === 1) {
      const starSnapshot = () => page.evaluate(async () => {
        const { director } = await import('/src/presentation/transitions/director.ts');
        return director.host.game.scene.getScene('MenuScene').galaxy.list
          .filter(object => object.name === 'moving-white-star')
          .map(object => ({ x: object.x, y: object.y, alpha: object.alpha }));
      });
      const before = await starSnapshot();
      assert.equal(before.length, 30);
      await page.waitForTimeout(1200);
      const after = await starSnapshot();
      assert.ok(after.some((star, i) => Math.hypot(star.x - before[i].x, star.y - before[i].y) > 6), 'white stars visibly move');
      await page.evaluate(async () => (await import('/src/presentation/transitions/motion.ts')).setMotionScale(0));
      const paused = await starSnapshot();
      await page.waitForTimeout(400);
      assert.deepEqual(await starSnapshot(), paused, 'reduced motion freezes star movement and twinkle');
      await page.evaluate(async () => (await import('/src/presentation/transitions/motion.ts')).setMotionScale(1));
    }
    await page.screenshot({ path: new URL(`menu-${label}.png`, output).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
    await page.mouse.click(195, height * 0.915);
    await waitScene('LevelSelectScene');
    await page.screenshot({ path: new URL(`map-${label}.png`, output).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
    // Drag starting on a playable node must scroll, not enter the level.
    const node = await page.evaluate(async () => {
      const { director } = await import('/src/presentation/transitions/director.ts');
      const scene = director.host.game.scene.getScene('LevelSelectScene');
      const current = scene.nodeViews.find(n => n.info.state === 'current') ?? scene.nodeViews[2];
      const scale = scene.scale.width / 720 / devicePixelRatio;
      return { x: current.info.x * scale, y: (current.info.y + scene.mapContainer.y) * scale };
    });
    await page.mouse.move(node.x, node.y);
    await page.mouse.down();
    await page.mouse.move(node.x, node.y - 110, { steps: 12 });
    await page.mouse.up();
    await waitScene('LevelSelectScene');
    await page.mouse.click(30, 30);
    await waitScene('MenuScene');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: new URL(`return-${label}.png`, output).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
    await page.mouse.click(195, height * 0.828);
    await waitScene('PlayScene');
    await context.close();
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log('Galaxy UI screenshots captured; no browser runtime errors.');
} finally {
  await browser.close();
}
