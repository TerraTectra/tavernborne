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

const heroAppearance = async (id) => {
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

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();

  stage = 'rigged-appearance';
  for (const id of ['mira', 'kael', 'liora']) {
    await page.getByTestId(`hero-3d-${id}`).waitFor({ timeout: 20_000 });
    await page.waitForFunction(
      (heroId) => document.querySelector(`[data-testid="hero-3d-${heroId}"]`)?.getAttribute('data-visual-mode') === 'rigged-asset',
      id,
      { timeout: 20_000 },
    );
  }

  const initial = await Promise.all(['mira', 'kael', 'liora'].map(heroAppearance));
  diagnostics.initial = initial;
  assert.equal(new Set(initial.map((hero) => hero.profile)).size, 3, 'Heroes do not have distinct appearance profiles');
  for (const hero of initial) {
    assert.equal(hero.mode, 'rigged-asset', `${hero.id} fell back to the procedural body`);
    assert.ok(hero.profile && hero.profile !== 'family-initiate', `${hero.id} has no authored appearance profile`);
    assert.ok(hero.modules >= 6, `${hero.id} has too few modular appearance parts: ${hero.modules}`);
    assert.equal(hero.equipment, 'stowed', `${hero.id} should begin with equipment stowed`);
  }
  await page.screenshot({ path: 'modular-appearance-camp.png', fullPage: true });

  stage = 'equipment-transition';
  let drewEquipment = false;
  for (let step = 0; step < 12; step += 1) {
    await page.getByRole('button', { name: '+1 час', exact: true }).click();
    await page.waitForTimeout(800);
    const state = await Promise.all(['mira', 'kael', 'liora'].map(heroAppearance));
    diagnostics[`hour${step + 1}`] = state;
    if (state.some((hero) => hero.equipment === 'drawn')) {
      drewEquipment = true;
      break;
    }
  }
  assert.ok(drewEquipment, 'No hero drew equipment during training or expedition preparation');
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
