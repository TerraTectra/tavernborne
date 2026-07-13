import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const pageErrors = [];
let stage = 'startup';
const diagnostics = {};

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const campAppearance = async (id) => {
  const label = page.getByTestId(`hero-3d-${id}`);
  return {
    id,
    mode: await label.getAttribute('data-visual-mode'),
    profile: await label.getAttribute('data-appearance-profile'),
    modules: Number(await label.getAttribute('data-appearance-modules')),
    equipment: await label.getAttribute('data-equipment-state'),
    animation: await label.getAttribute('data-animation'),
  };
};

const advanceHour = async (wait = 800) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click({ noWaitAfter: true });
  await page.waitForTimeout(wait);
};

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();

  stage = 'rigged-appearance';
  await page.waitForFunction(() => ['mira', 'kael', 'liora'].every((id) => {
    const hero = document.querySelector(`[data-testid="hero-3d-${id}"]`);
    return hero?.getAttribute('data-visual-mode') === 'rigged-asset';
  }), undefined, { timeout: 25_000 });

  const initial = await Promise.all(['mira', 'kael', 'liora'].map(campAppearance));
  diagnostics.initial = initial;
  assert.equal(new Set(initial.map((hero) => hero.profile)).size, 3, 'Heroes do not have distinct appearance profiles');
  for (const hero of initial) {
    assert.equal(hero.mode, 'rigged-asset', `${hero.id} fell back to the procedural body`);
    assert.ok(hero.profile && hero.profile !== 'family-initiate', `${hero.id} has no authored appearance profile`);
    assert.ok(hero.modules >= 6, `${hero.id} has too few modular appearance parts: ${hero.modules}`);
    assert.equal(hero.equipment, 'stowed', `${hero.id} should begin with equipment stowed`);
  }
  await page.screenshot({ path: 'modular-appearance-camp.png', fullPage: true });

  stage = 'dungeon-equipment';
  await page.getByRole('button', { name: 'x1', exact: true }).click({ noWaitAfter: true });
  await page.getByRole('button', { name: 'x2', exact: true }).click({ noWaitAfter: true });
  await advanceHour(1700);
  await advanceHour(1700);
  for (let hour = 0; hour < 5; hour += 1) await advanceHour(1000);

  await page.getByTestId('dungeon-visual-overlay').waitFor({ timeout: 12_000 });
  await page.waitForFunction(() => {
    const labels = [...document.querySelectorAll('[data-testid^="dungeon-hero-3d-"]')];
    return labels.filter((label) =>
      label.getAttribute('data-visual-mode') === 'rigged-asset'
      && label.getAttribute('data-equipment-state') === 'drawn'
    ).length >= 2;
  }, undefined, { timeout: 25_000 });

  const dungeonState = await page.locator('[data-testid^="dungeon-hero-3d-"]').evaluateAll((labels) => labels.map((label) => ({
    id: label.getAttribute('data-testid'),
    mode: label.getAttribute('data-visual-mode'),
    profile: label.getAttribute('data-appearance-profile'),
    modules: Number(label.getAttribute('data-appearance-modules')),
    equipment: label.getAttribute('data-equipment-state'),
    animation: label.getAttribute('data-animation'),
  })).filter((hero) => hero.mode === 'rigged-asset'));

  diagnostics.dungeon = dungeonState;
  assert.ok(dungeonState.length >= 2, `Dungeon party is unexpectedly small: ${dungeonState.length}`);
  for (const hero of dungeonState) {
    assert.ok(hero.profile && hero.profile !== 'family-initiate', `${hero.id} lost its appearance profile in the dungeon`);
    assert.ok(hero.modules >= 6, `${hero.id} lost modular parts in the dungeon`);
    assert.equal(hero.equipment, 'drawn', `${hero.id} did not draw equipment in the dungeon`);
  }
  await page.screenshot({ path: 'modular-appearance-equipped.png', fullPage: true });

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  writeFileSync('modular-appearance-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors }, null, 2));
  console.log('Modular appearance browser smoke test passed.');
} catch (error) {
  writeFileSync('modular-appearance-diagnostics.json', JSON.stringify({
    ok: false,
    stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics,
    pageErrors,
  }, null, 2));
  console.error('Modular appearance browser smoke test failed:', error);
  throw error;
} finally {
  await browser.close();
}
