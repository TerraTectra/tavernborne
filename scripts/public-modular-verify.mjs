import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'https://terratectra.github.io/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const errors = [];

page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

try {
  await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor({ timeout: 30_000 });

  const heroes = [];
  for (const id of ['mira', 'kael', 'liora']) {
    await page.waitForFunction(
      (heroId) => document.querySelector(`[data-testid="hero-3d-${heroId}"]`)?.getAttribute('data-visual-mode') === 'rigged-asset',
      id,
      { timeout: 30_000 },
    );
    const label = page.getByTestId(`hero-3d-${id}`);
    heroes.push({
      id,
      profile: await label.getAttribute('data-appearance-profile'),
      modules: Number(await label.getAttribute('data-appearance-modules')),
      equipment: await label.getAttribute('data-equipment-state'),
      animationCount: Number(await label.getAttribute('data-animation-count')),
    });
  }

  assert.equal(new Set(heroes.map((hero) => hero.profile)).size, 3, 'Public build does not expose three distinct hero profiles');
  for (const hero of heroes) {
    assert.ok(hero.profile && hero.profile !== 'family-initiate', `${hero.id} has no public appearance profile`);
    assert.ok(hero.modules >= 6, `${hero.id} has too few public appearance modules`);
    assert.ok(hero.animationCount >= 40, `${hero.id} lost the animation library`);
  }
  assert.equal(errors.length, 0, `Public page errors: ${errors.join(' | ')}`);
  await page.screenshot({ path: 'public-modular-appearance.png', fullPage: true });
  writeFileSync('public-modular-diagnostics.json', JSON.stringify({ ok: true, testUrl, heroes, errors }, null, 2));
  console.log('Public modular appearance verification passed.');
} catch (error) {
  writeFileSync('public-modular-diagnostics.json', JSON.stringify({
    ok: false,
    testUrl,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    errors,
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
