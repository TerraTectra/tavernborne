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
  const manifestResponse = await page.request.get(new URL('assets/quaternius/manifest.json', testUrl).toString());
  assert.equal(manifestResponse.status(), 200, 'Public Quaternius manifest is unavailable');
  const manifest = await manifestResponse.json();
  for (const required of ['market', 'tree', 'rock', 'bush', 'lamp', 'crate', 'barrel', 'shrine']) {
    assert.ok(manifest.models?.[required]?.file, `Public environment model ${required} is absent`);
  }

  await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor({ timeout: 30_000 });
  await page.getByTestId('camp-3d-layer').waitFor({ timeout: 30_000 });

  const probeIds = [
    'environment-home',
    'environment-workshop',
    'environment-dining',
    'environment-training',
    'environment-dungeon-gate',
    'environment-tree',
    'environment-rock',
    'environment-bush',
    'environment-camp-light',
  ];

  for (const id of probeIds) {
    await page.waitForFunction(
      (probeId) => window.__tavernborneEnvironment?.[probeId]?.mode === 'curated-asset',
      id,
      { timeout: 30_000 },
    );
  }

  const environment = await page.evaluate((ids) => ids.map((id) => ({ id, ...window.__tavernborneEnvironment[id] })), probeIds);
  assert.ok(new Set(environment.map((probe) => probe.asset)).size >= 7, 'Public camp does not expose enough distinct curated assets');
  for (const probe of environment) {
    assert.equal(probe.mode, 'curated-asset', `${probe.id} fell back to a procedural model`);
    assert.ok(probe.asset && probe.asset !== 'none', `${probe.id} has no resolved asset`);
    assert.ok(probe.source && probe.source !== 'unknown', `${probe.id} has no source pack`);
  }

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
      animations: Number(await label.getAttribute('data-animation-count')),
    });
  }
  assert.equal(new Set(heroes.map((hero) => hero.profile)).size, 3, 'Public build lost distinct hero profiles');
  for (const hero of heroes) {
    assert.ok(hero.modules >= 6, `${hero.id} lost modular appearance parts`);
    assert.ok(hero.animations >= 40, `${hero.id} lost the animation library`);
  }

  const tickBefore = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2'))?.tick ?? 0);
  await page.getByRole('button', { name: '+1 час', exact: true }).click({ noWaitAfter: true });
  await page.waitForFunction((before) => (JSON.parse(window.localStorage.getItem('tavernborne.world.v2'))?.tick ?? 0) > before, tickBefore, { timeout: 10_000 });

  assert.equal(errors.length, 0, `Public page errors: ${errors.join(' | ')}`);
  await page.screenshot({ path: 'public-environment-v1.png', fullPage: true });
  writeFileSync('public-environment-diagnostics.json', JSON.stringify({ ok: true, testUrl, environment, heroes, errors }, null, 2));
  console.log('Public environment verification passed.');
} catch (error) {
  writeFileSync('public-environment-diagnostics.json', JSON.stringify({
    ok: false,
    testUrl,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    errors,
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
