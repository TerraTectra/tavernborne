import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'https://terratectra.github.io/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const errors = [];
const diagnostics = {};
let stage = 'startup';

page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

const advanceHour = async (wait = 850) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click({ noWaitAfter: true });
  await page.waitForTimeout(wait);
};

try {
  stage = 'open-public-camp';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor({ timeout: 30_000 });
  await page.getByTestId('camp-3d-layer').waitFor({ timeout: 30_000 });

  stage = 'public-camp-polish';
  const campPolish = page.getByTestId('visual-polish-camp-layer');
  await campPolish.waitFor({ timeout: 30_000 });
  diagnostics.camp = {
    version: await campPolish.getAttribute('data-visual-polish'),
    lighting: await campPolish.getAttribute('data-lighting-rig'),
    framing: await campPolish.getAttribute('data-camera-framing'),
  };
  assert.equal(diagnostics.camp.version, 'v1', 'Public camp does not expose Visual Polish v1');
  assert.equal(diagnostics.camp.lighting, 'warm-cinematic', 'Public camp lighting rig is missing');

  await page.waitForFunction(() => ['mira', 'kael', 'liora'].every((id) => {
    const hero = document.querySelector(`[data-testid="hero-3d-${id}"]`);
    return hero?.getAttribute('data-visual-mode') === 'rigged-asset'
      && Number(hero.getAttribute('data-animation-count') ?? 0) >= 40;
  }), undefined, { timeout: 35_000 });

  diagnostics.heroes = await page.locator('[data-testid^="hero-3d-"]').evaluateAll((labels) => labels.map((label) => ({
    id: label.getAttribute('data-testid'),
    mode: label.getAttribute('data-visual-mode'),
    profile: label.getAttribute('data-appearance-profile'),
    modules: Number(label.getAttribute('data-appearance-modules')),
    animationCount: Number(label.getAttribute('data-animation-count')),
  })));
  assert.ok(diagnostics.heroes.length >= 3, 'Public camp is missing hero rigs');
  await page.screenshot({ path: 'public-visual-polish-camp.png', fullPage: true });

  stage = 'public-dungeon-transition';
  for (let hour = 0; hour < 7; hour += 1) await advanceHour();
  await page.getByTestId('dungeon-rts-map').waitFor({ timeout: 25_000 });

  stage = 'public-modular-dungeon';
  const dungeonPolish = page.getByTestId('visual-polish-dungeon-layer');
  await dungeonPolish.waitFor({ timeout: 30_000 });
  await dungeonPolish.locator('canvas').waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="visual-polish-dungeon-layer"]')?.getAttribute('data-room-count') ?? 0) >= 1, undefined, { timeout: 20_000 });

  diagnostics.dungeon = {
    version: await dungeonPolish.getAttribute('data-visual-polish'),
    kit: await dungeonPolish.getAttribute('data-dungeon-kit'),
    rooms: Number(await dungeonPolish.getAttribute('data-room-count')),
  };
  assert.equal(diagnostics.dungeon.version, 'v1', 'Public dungeon does not expose Visual Polish v1');
  assert.equal(diagnostics.dungeon.kit, 'modular-stone-v1', 'Public modular dungeon kit is missing');
  assert.ok(diagnostics.dungeon.rooms >= 1, 'Public modular dungeon has no discovered rooms');
  assert.equal(errors.length, 0, `Public page errors: ${errors.join(' | ')}`);

  await page.screenshot({ path: 'public-visual-polish-dungeon.png', fullPage: true });
  writeFileSync('public-visual-polish-diagnostics.json', JSON.stringify({ ok: true, stage, testUrl, diagnostics, errors }, null, 2));
  console.log('Public Visual Polish v1 verification passed.');
} catch (error) {
  writeFileSync('public-visual-polish-diagnostics.json', JSON.stringify({
    ok: false,
    stage,
    testUrl,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics,
    errors,
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
