import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const pageErrors = [];
const diagnostics = {};
let stage = 'startup';

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const advanceHour = async (wait = 650) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click({ noWaitAfter: true });
  await page.waitForTimeout(wait);
};

try {
  stage = 'open-camp';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor({ timeout: 20_000 });
  await page.getByTestId('camp-3d-layer').waitFor({ timeout: 20_000 });

  stage = 'camp-polish';
  const campPolish = page.getByTestId('visual-polish-camp-layer');
  await campPolish.waitFor({ timeout: 15_000 });
  diagnostics.camp = {
    version: await campPolish.getAttribute('data-visual-polish'),
    lighting: await campPolish.getAttribute('data-lighting-rig'),
    framing: await campPolish.getAttribute('data-camera-framing'),
  };
  assert.equal(diagnostics.camp.version, 'v1', 'Camp polish layer has the wrong version');
  assert.equal(diagnostics.camp.lighting, 'warm-cinematic', 'Camp cinematic lighting marker is missing');

  const campCanvasStyle = await page.getByTestId('camp-3d-layer').locator('canvas').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { filter: style.filter, transform: style.transform };
  });
  diagnostics.campCanvasStyle = campCanvasStyle;
  assert.ok(campCanvasStyle.filter.includes('saturate') && campCanvasStyle.filter.includes('contrast'), 'Camp color grading is not applied');
  assert.notEqual(campCanvasStyle.transform, 'none', 'Camp framing scale is not applied');

  stage = 'dungeon-transition';
  for (let hour = 0; hour < 7; hour += 1) await advanceHour();
  await page.getByTestId('dungeon-rts-map').waitFor({ timeout: 20_000 });

  stage = 'modular-dungeon';
  const dungeonPolish = page.getByTestId('visual-polish-dungeon-layer');
  await dungeonPolish.waitFor({ timeout: 20_000 });
  await dungeonPolish.locator('canvas').waitFor({ timeout: 10_000 });
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="visual-polish-dungeon-layer"]')?.getAttribute('data-room-count') ?? 0) >= 1, undefined, { timeout: 15_000 });

  const dungeonBox = await dungeonPolish.locator('canvas').boundingBox();
  diagnostics.dungeon = {
    version: await dungeonPolish.getAttribute('data-visual-polish'),
    kit: await dungeonPolish.getAttribute('data-dungeon-kit'),
    rooms: Number(await dungeonPolish.getAttribute('data-room-count')),
    box: dungeonBox,
  };
  assert.equal(diagnostics.dungeon.version, 'v1', 'Dungeon polish layer has the wrong version');
  assert.equal(diagnostics.dungeon.kit, 'modular-stone-v1', 'Modular dungeon architecture marker is missing');
  assert.ok(diagnostics.dungeon.rooms >= 1, 'No discovered room was passed into the modular dungeon kit');
  assert.ok(dungeonBox && dungeonBox.width > 700 && dungeonBox.height > 500, 'Modular dungeon canvas does not fill the scene');

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  await page.screenshot({ path: 'visual-polish-v1.png', fullPage: true });
  writeFileSync('visual-polish-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors }, null, 2));
  console.log('Visual Polish v1 browser smoke test passed.');
} catch (error) {
  writeFileSync('visual-polish-diagnostics.json', JSON.stringify({
    ok: false,
    stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics,
    pageErrors,
  }, null, 2));
  console.error('Visual Polish v1 browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'visual-polish-failure.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
