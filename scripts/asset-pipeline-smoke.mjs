import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const pageErrors = [];
let stage = 'startup';
let diagnostics = {};

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const inspectGlb = (filePath) => {
  const bytes = readFileSync(filePath);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'Generated character is not a GLB file');
  assert.equal(bytes.readUInt32LE(4), 2, 'Unsupported GLB version');
  let offset = 12;
  let json;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + chunkLength;
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(bytes.subarray(start, end).toString('utf8').replace(/[\u0000\u0020]+$/g, ''));
      break;
    }
    offset = end;
  }
  assert.ok(json, 'GLB JSON chunk is missing');
  return {
    animationNames: (json.animations ?? []).map((animation) => animation.name ?? '(unnamed)'),
    animationCount: json.animations?.length ?? 0,
    meshCount: json.meshes?.length ?? 0,
    skinCount: json.skins?.length ?? 0,
    nodeCount: json.nodes?.length ?? 0,
    sceneCount: json.scenes?.length ?? 0,
  };
};

const heroState = async (id) => {
  const label = page.getByTestId(`hero-3d-${id}`);
  return {
    id,
    mode: await label.getAttribute('data-visual-mode'),
    animation: await label.getAttribute('data-animation'),
    animationCount: Number(await label.getAttribute('data-animation-count')),
    source: await label.getAttribute('data-asset-source'),
  };
};

const advanceHour = async (wait = 1000) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click();
  await page.waitForTimeout(wait);
};

try {
  stage = 'glb-metadata';
  diagnostics.glb = inspectGlb('public/assets/quaternius/characters/universalHumanoid/model.glb');
  assert.ok(diagnostics.glb.meshCount > 0, 'Animated GLB contains no visible mesh');
  assert.ok(diagnostics.glb.skinCount > 0, 'Animated GLB contains no skeleton skin');
  assert.ok(diagnostics.glb.animationCount > 0, 'Animated GLB contains no animation clips');

  stage = 'manifest';
  console.log(`Opening Tavernborne asset build at ${testUrl}...`);
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();

  const assetInfo = await page.evaluate(async () => {
    const manifestUrl = new URL('assets/quaternius/manifest.json', document.baseURI);
    const response = await fetch(manifestUrl, { cache: 'no-cache' });
    const manifest = await response.json();
    const character = manifest.characters?.universalHumanoid;
    if (!character?.file) return { manifestStatus: response.status, character: null, assetStatus: 0, assetBytes: 0, source: manifest.sources };
    const assetResponse = await fetch(new URL(character.file, document.baseURI));
    const bytes = (await assetResponse.arrayBuffer()).byteLength;
    return {
      manifestStatus: response.status,
      character,
      assetStatus: assetResponse.status,
      assetBytes: bytes,
      source: manifest.sources?.find((entry) => entry.id === 'universal-animation-library'),
      license: manifest.license,
      licenseUrl: manifest.licenseUrl,
    };
  });
  diagnostics.assetInfo = assetInfo;
  assert.equal(assetInfo.manifestStatus, 200, 'Quaternius manifest is unavailable');
  assert.ok(assetInfo.character?.file, 'Animated humanoid is missing from the manifest');
  assert.equal(assetInfo.assetStatus, 200, 'Animated humanoid GLB is unavailable');
  assert.ok(assetInfo.assetBytes > 20_000, 'Animated humanoid GLB is unexpectedly small');
  assert.equal(assetInfo.license, 'CC0-1.0', 'Asset license is not recorded as CC0');
  assert.equal(assetInfo.source?.status, 'ready', 'Universal Animation Library was not prepared by the build');

  stage = 'rigged-heroes';
  console.log('Waiting for skinned GLB heroes and animation clips...');
  for (const id of ['mira', 'kael', 'liora']) {
    const label = page.getByTestId(`hero-3d-${id}`);
    await label.waitFor({ timeout: 15_000 });
    await page.waitForFunction(
      (heroId) => document.querySelector(`[data-testid="hero-3d-${heroId}"]`)?.getAttribute('data-visual-mode') === 'rigged-asset',
      id,
      { timeout: 20_000 },
    );
  }

  const initialHeroes = await Promise.all(['mira', 'kael', 'liora'].map(heroState));
  diagnostics.initialHeroes = initialHeroes;
  for (const hero of initialHeroes) {
    assert.equal(hero.mode, 'rigged-asset', `${hero.id} remained on the procedural fallback`);
    assert.equal(hero.source, 'quaternius-universal-animation-library', `${hero.id} has an unknown asset source`);
    assert.ok(hero.animationCount > 0, `${hero.id} loaded no animation clips`);
    assert.ok(hero.animation && hero.animation !== 'none', `${hero.id} has no active animation`);
  }

  stage = 'selection';
  await page.getByTestId('hero-3d-liora').click();
  await page.waitForTimeout(400);
  assert.ok((await page.locator('aside').textContent())?.includes('Лиора'), 'Rigged character selection no longer reaches the hero panel');
  await page.screenshot({ path: 'asset-pipeline-camp.png', fullPage: true });

  stage = 'animation-transition';
  console.log('Checking that simulation state changes drive the animation graph...');
  const animationsBefore = Object.fromEntries(initialHeroes.map((hero) => [hero.id, hero.animation]));
  await advanceHour(1600);
  const afterBreakfast = await Promise.all(['mira', 'kael', 'liora'].map(heroState));
  diagnostics.afterBreakfast = afterBreakfast;
  assert.ok(afterBreakfast.every((hero) => hero.mode === 'rigged-asset'), 'A hero fell back to the procedural body after the first simulation step');
  assert.ok(afterBreakfast.some((hero) => hero.animation !== animationsBefore[hero.id]), 'The animation graph did not react to the new simulation action');

  stage = 'movement-transition';
  await advanceHour(1600);
  const afterCouncil = await Promise.all(['mira', 'kael', 'liora'].map(heroState));
  diagnostics.afterCouncil = afterCouncil;
  assert.ok(afterCouncil.every((hero) => hero.animationCount > 0), 'Animation clips disappeared after scene transition');

  stage = 'page-errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  writeFileSync('asset-pipeline-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors }, null, 2));
  console.log('Animated asset pipeline browser smoke test passed.');
} catch (error) {
  writeFileSync('asset-pipeline-diagnostics.json', JSON.stringify({
    ok: false,
    stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics,
    pageErrors,
  }, null, 2));
  console.error('Animated asset pipeline browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'asset-pipeline-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
