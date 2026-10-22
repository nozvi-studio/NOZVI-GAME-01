// Visual and motion check for chapters 3-5 (ring, cluster, prism: menu heroes, galaxy layers, map bands).
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
const output = new URL('../../.shots/galaxy/', import.meta.url);
mkdirSync(output, { recursive: true });
const errors = [];

const waitScene = async (page, key) => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const ok = await page.evaluate(async key => {
      const { director } = await import('/src/presentation/transitions/SceneDirector.ts');
      const scene = director.host?.game.scene.getScene(key);
      return scene?.sys.settings.status === 5 && scene.scene.isActive() && !director.isTransitioning() && scene.input.enabled;
    }, key);
    if (ok) return;
    await page.waitForTimeout(100);
  }
  assert.fail(`${key} never became ready`);
};

/** Reads a number from a named layer of the menu galaxy; the layer may sit inside a rotated group. */
const layerValue = (page, stem, prop) => page.evaluate(async ({ stem, prop }) => {
  const { director } = await import('/src/presentation/transitions/SceneDirector.ts');
  const find = (obj) => obj.name === stem ? obj : obj.list?.map(find).find(Boolean);
  const layer = find(director.host.game.scene.getScene('MenuScene').galaxy);
  return layer ? layer[prop] : null;
}, { stem, prop });

const PULSE = { 3: ['ring-core', 'scaleX'], 4: ['cluster-web', 'alpha'], 5: ['prism-shards-0', 'y'] };
const EXPECTED_LAYERS = { 3: ['ring', 'ring-core'], 4: ['cluster', 'cluster-web', 'cluster-core', 'cluster-galaxies-0', 'cluster-galaxies-3', 'cluster-meteor-2'], 5: ['prism', 'prism-beam', 'prism-fan', 'prism-glass', 'prism-shards-2'] };

try {
  for (const chapter of [3, 4, 5]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:5173/?scene=menu&chapter=${chapter}`);
    await waitScene(page, 'MenuScene');
    await page.waitForTimeout(2600); // intro tweens finish
    await page.screenshot({ path: fileURLToPath(new URL(`menu-ch${chapter}.png`, output)) });

    for (const stem of EXPECTED_LAYERS[chapter]) assert.notEqual(await layerValue(page, stem, 'type'), null, `ch${chapter}: layer ${stem} exists`);

    const [stem, prop] = PULSE[chapter];
    const before = await layerValue(page, stem, prop);
    await page.waitForTimeout(1200);
    assert.notEqual(await layerValue(page, stem, prop), before, `ch${chapter}: ${stem}.${prop} animates`);
    await page.evaluate(async () => (await import('/src/presentation/transitions/motion.ts')).setMotionScale(0));
    await page.waitForTimeout(200); // let the next frame apply the pause before sampling
    const frozen = await layerValue(page, stem, prop);
    await page.waitForTimeout(400);
    assert.equal(await layerValue(page, stem, prop), frozen, `ch${chapter}: reduced motion freezes ${stem}`);
    // Meteors are transient by design: they stay hidden when motion is off, every other layer must remain visible.
    for (const layerStem of EXPECTED_LAYERS[chapter].filter(name => !name.startsWith('cluster-meteor'))) {
      assert.ok((await layerValue(page, layerStem, 'alpha')) > 0, `ch${chapter}: ${layerStem} visible under reduced motion`);
    }
    await page.evaluate(async () => (await import('/src/presentation/transitions/motion.ts')).setMotionScale(1));

    if (chapter === 3) { // chapter III: the hero's arrow and pinwheel turn slowly, and stop under reduced motion
      const heroSpin = () => page.evaluate(async () => {
        const { director } = await import('/src/presentation/transitions/SceneDirector.ts');
        const emblem = director.host.game.scene.getScene('MenuScene').emblem;
        return [emblem.arrow.rotation, emblem.pinwheel.rotation];
      });
      const before = await heroSpin();
      await page.waitForTimeout(1500);
      const after = await heroSpin();
      assert.ok(after[0] - before[0] > 0.01 && after[0] - before[0] < 1, 'ch3: arrow turns gently');
      assert.ok(after[1] - before[1] > 0.01 && after[1] - before[1] < 1, 'ch3: pinwheel turns gently');
      await page.evaluate(async () => (await import('/src/presentation/transitions/motion.ts')).setMotionScale(0));
      await page.waitForTimeout(200);
      const held = await heroSpin();
      await page.waitForTimeout(400);
      assert.deepEqual(await heroSpin(), held, 'ch3: reduced motion stops the hero spin');
      await page.evaluate(async () => (await import('/src/presentation/transitions/motion.ts')).setMotionScale(1));
    }
    if (chapter === 4) { // a meteor must cross within one 8 s cycle
      let seen = false;
      for (let i = 0; i < 90 && !seen; i++) {
        for (const n of [0, 1, 2]) seen ||= (await layerValue(page, `cluster-meteor-${n}`, 'alpha')) > 0.5;
        await page.waitForTimeout(100);
      }
      assert.ok(seen, 'a cluster meteor becomes visible');
    }
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:5173/?scene=levelSelect&revealAll=1');
  await waitScene(page, 'LevelSelectScene');
  const bands = await page.evaluate(async () => {
    const { layoutCampaignMap } = await import('/src/presentation/galaxy/constellationLayout.ts');
    const { teaserChapters } = await import('/src/presentation/galaxy/galaxyTheme.ts');
    const { campaignManifest } = await import('/src/content/manifest.ts');
    return layoutCampaignMap(campaignManifest, teaserChapters(campaignManifest)).chapters;
  });
  assert.deepEqual(bands.map(b => [b.chapter, b.nodeCount]), [[1, 6], [2, 6], [3, 10], [4, 6], [5, 0]]);
  for (const band of bands) {
    await page.evaluate(async ({ top, bottom }) => {
      const { director } = await import('/src/presentation/transitions/SceneDirector.ts');
      const scene = director.host.game.scene.getScene('LevelSelectScene');
      const halfView = scene.cameras.main.height / scene.cameras.main.zoom / 2;
      scene.mapContainer.y = halfView - (top + bottom) / 2;
    }, band);
    await page.waitForTimeout(600);
    await page.screenshot({ path: fileURLToPath(new URL(`map-band-${band.chapter}.png`, output)) });
  }
  await context.close();
} finally {
  await browser.close();
}
assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
console.log('galaxy chapter 3-5 checks passed');
