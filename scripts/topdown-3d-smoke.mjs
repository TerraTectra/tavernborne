import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const pageErrors = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const advanceHour = async (wait = 700) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click();
  await page.waitForTimeout(wait);
};

try {
  console.log(`Opening live top-down 3D world at ${testUrl}...`);
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();

  console.log('Checking the 3D camp renderer and articulated heroes...');
  const campLayer = page.getByTestId('camp-3d-layer');
  await campLayer.waitFor({ timeout: 10000 });
  await page.getByTestId('camp-3d-status').waitFor();
  const campCanvas = campLayer.locator('canvas');
  await campCanvas.waitFor();
  const campBox = await campCanvas.boundingBox();
  assert.ok(campBox && campBox.width > 700 && campBox.height > 500, '3D camp canvas is not filling the game map');

  for (const id of ['mira', 'kael', 'liora']) {
    await page.getByTestId(`hero-3d-${id}`).waitFor({ timeout: 10000 });
  }
  assert.equal(await page.getByTestId('hero-3d-mira').count(), 1, 'Mira 3D body is missing');
  assert.equal(await page.getByTestId('hero-3d-kael').count(), 1, 'Kael 3D body is missing');
  assert.equal(await page.getByTestId('hero-3d-liora').count(), 1, 'Liora 3D body is missing');

  console.log('Checking selection through the 3D label...');
  await page.getByTestId('hero-3d-liora').click();
  await page.waitForTimeout(350);
  assert.equal(await page.getByTestId('actor-liora').evaluate((element) => element.classList.contains('rts-unit-selected')), true, '3D hero selection did not reach the game state');

  console.log('Checking that the existing simulation still drives 3D movement...');
  const before = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2'))?.tick ?? 0);
  await advanceHour(1200);
  const after = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2'))?.tick ?? 0);
  assert.ok(after > before, 'Time controls no longer advance the world under the 3D renderer');
  await campLayer.waitFor();

  console.log('Advancing to the 3D dungeon transition...');
  for (let hour = 0; hour < 6; hour += 1) await advanceHour(1050);
  const dungeonOverlay = page.getByTestId('dungeon-visual-overlay');
  await dungeonOverlay.waitFor({ timeout: 10000 });
  const dungeonMap = page.getByTestId('dungeon-rts-map');
  await dungeonMap.waitFor();
  const dungeonCanvas = dungeonMap.locator('canvas');
  await dungeonCanvas.waitFor();
  const dungeonBox = await dungeonCanvas.boundingBox();
  assert.ok(dungeonBox && dungeonBox.width > 700 && dungeonBox.height > 500, '3D dungeon canvas is not visible');
  assert.equal(await page.getByTestId('dungeon-room-entrance').getAttribute('data-discovered'), 'true', '3D dungeon entrance is not revealed');
  assert.ok(await page.locator('[data-testid^="dungeon-party-"]').count() >= 2, '3D expedition party is missing');
  assert.equal(await page.locator('[data-role="leader"]').count(), 1, '3D dungeon leader marker is missing');
  assert.equal(await page.locator('[data-role="scout"]').count(), 1, '3D dungeon scout marker is missing');

  console.log('Checking live room reveal in the 3D dungeon...');
  await advanceHour(1500);
  assert.equal(await page.getByTestId('dungeon-room-hall').getAttribute('data-discovered'), 'true', '3D scout did not reveal the next room');
  assert.ok((await page.getByTestId('dungeon-phase').textContent())?.includes('Разведка'), '3D dungeon phase did not advance');

  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  console.log('Top-down 3D browser smoke test passed.');
} catch (error) {
  console.error('Top-down 3D browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'topdown-3d-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
