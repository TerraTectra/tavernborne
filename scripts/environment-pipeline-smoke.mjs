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

const probeState = async (testId) => page.evaluate((id) => {
  const state = window.__tavernborneEnvironment?.[id];
  return {
    testId: id,
    mode: state?.mode ?? null,
    asset: state?.asset ?? null,
    source: state?.source ?? null,
  };
}, testId);

try {
  stage = 'manifest';
  const manifestResponse = await fetch(new URL('assets/quaternius/manifest.json', testUrl));
  assert.equal(manifestResponse.status, 200, 'Quaternius manifest is unavailable');
  const manifest = await manifestResponse.json();
  diagnostics.manifest = {
    modelIds: Object.keys(manifest.models ?? {}),
    sourceStates: manifest.sources?.map((source) => ({ id: source.id, status: source.status })),
    missing: manifest.missing,
  };
  for (const required of ['market', 'tree', 'rock', 'bush', 'lamp', 'crate', 'barrel', 'shrine']) {
    assert.ok(manifest.models?.[required]?.file, `Environment model ${required} is absent from the manifest`);
  }

  stage = 'camp';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await page.getByTestId('camp-3d-layer').waitFor();

  const probes = [
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

  for (const testId of probes) {
    await page.waitForFunction(
      (id) => window.__tavernborneEnvironment?.[id]?.mode === 'curated-asset',
      testId,
      { timeout: 25_000 },
    );
  }

  diagnostics.camp = await Promise.all(probes.map(probeState));
  for (const probe of diagnostics.camp) {
    assert.equal(probe.mode, 'curated-asset', `${probe.testId} remained on the procedural fallback`);
    assert.ok(probe.asset && probe.asset !== 'none', `${probe.testId} has no resolved asset id`);
    assert.ok(probe.source && probe.source !== 'unknown', `${probe.testId} has no source pack`);
  }
  assert.ok(new Set(diagnostics.camp.map((probe) => probe.asset)).size >= 7, 'The camp does not use enough distinct environment assets');

  stage = 'interaction';
  await page.getByRole('button', { name: 'x1', exact: true }).click({ noWaitAfter: true });
  await page.getByRole('button', { name: 'x2', exact: true }).waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: '+1 час', exact: true }).click({ noWaitAfter: true });
  await page.waitForTimeout(700);

  stage = 'heroes-preserved';
  for (const heroId of ['mira', 'kael', 'liora']) {
    await page.waitForFunction(
      (id) => document.querySelector(`[data-testid="hero-3d-${id}"]`)?.getAttribute('data-visual-mode') === 'rigged-asset',
      heroId,
      { timeout: 20_000 },
    );
  }

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  await page.screenshot({ path: 'environment-pipeline-camp.png', fullPage: true });
  writeFileSync('environment-pipeline-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors }, null, 2));
  console.log('Environment pipeline browser smoke test passed.');
} catch (error) {
  writeFileSync('environment-pipeline-diagnostics.json', JSON.stringify({
    ok: false,
    stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics,
    pageErrors,
  }, null, 2));
  console.error('Environment pipeline browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'environment-pipeline-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
