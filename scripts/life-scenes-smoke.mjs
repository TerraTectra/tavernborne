import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
const pageErrors = [];
let stage = 'startup';
let diagnostic = {};

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const advanceHour = async (wait = 180) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click();
  await page.waitForTimeout(wait);
};
const actorNumber = async (id, attribute) => Number(await page.getByTestId(`actor-${id}`).getAttribute(attribute));
const snapshot = async () => page.evaluate(() => {
  const world = JSON.parse(window.localStorage.getItem('tavernborne.world.v2') ?? 'null');
  const actors = ['mira', 'kael', 'liora'].map((id) => {
    const element = document.querySelector(`[data-testid="actor-${id}"]`);
    const label = document.querySelector(`[data-testid="hero-3d-${id}"]`);
    return {
      id,
      scene: element?.getAttribute('data-scene'),
      x: element?.getAttribute('data-x'),
      y: element?.getAttribute('data-y'),
      phase: element?.getAttribute('data-phase'),
      action: element?.getAttribute('data-action'),
      has3dLabel: Boolean(label),
      labelBox: label ? label.getBoundingClientRect().toJSON() : null,
    };
  });
  return {
    tick: world?.tick,
    activeLifeSceneId: world?.lifeScenes?.activeSceneId,
    lifeScenes: world?.lifeScenes?.scenes?.slice(0, 6),
    actors,
    reactionCount: document.querySelectorAll('.rts-scene-reaction').length,
    threeDLabels: document.querySelectorAll('[data-testid^="hero-3d-"]').length,
    panelText: document.querySelector('[data-testid="life-scene-panel"]')?.textContent,
  };
});

try {
  stage = 'open';
  console.log(`Opening visual daily life simulation at ${testUrl}...`);
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await page.getByTestId('rts-map').waitFor();
  await page.getByRole('button', { name: 'x1', exact: true }).click();
  await page.getByRole('button', { name: 'x2', exact: true }).click();

  stage = 'breakfast';
  console.log('Checking visual family breakfast...');
  await advanceHour(1800);
  const mealPanel = page.getByTestId('life-scene-panel');
  await mealPanel.waitFor();
  assert.equal(await mealPanel.getAttribute('data-scene-type'), 'meal', 'Завтрак не стал визуальной сценой');
  assert.ok((await mealPanel.textContent())?.includes('Семейный завтрак'), 'Нет названия семейного завтрака');
  assert.equal(await page.locator('.rts-bowl').count(), 3, 'Герои не держат миски во время общей еды');
  for (const id of ['mira', 'kael', 'liora']) {
    assert.ok((await page.getByTestId(`actor-${id}`).getAttribute('data-scene'))?.startsWith('life-'), `${id} не участвует в бытовой сцене`);
    assert.equal(await page.getByTestId(`actor-${id}`).getAttribute('data-action'), 'eat', `${id} не ест визуально`);
    assert.ok(await actorNumber(id, 'data-y') < 41, `${id} не подошёл к столу`);
  }
  assert.ok(await page.getByTestId('life-scene-participants').textContent(), 'Не показаны участники трапезы');

  stage = 'council-priority';
  console.log('Checking that expedition council takes priority...');
  await advanceHour(1700);
  await page.getByTestId('visual-scene-panel').waitFor();
  assert.equal(await mealPanel.count(), 0, 'Завтрак не уступил место более важному совету');

  stage = 'expedition';
  console.log('Completing council and entering the 3D expedition...');
  for (let hour = 0; hour < 5; hour += 1) await advanceHour(hour === 4 ? 2800 : 650);
  await page.getByTestId('dungeon-rts-map').waitFor({ timeout: 9000 });
  assert.ok((await page.getByTestId('dungeon-panel').textContent())?.includes('В подземелье'), 'Группа не вышла после визуального совета');
  for (let hour = 0; hour < 7; hour += 1) await advanceHour(300);

  stage = 'debrief';
  console.log('Checking visual expedition debrief...');
  await advanceHour(1700);
  await mealPanel.waitFor({ timeout: 8000 });
  assert.equal(await mealPanel.getAttribute('data-scene-type'), 'debrief', 'Возвращение не привело к визуальному разбору похода');
  assert.ok((await mealPanel.textContent())?.includes('Разбор похода'), 'Нет реплик разбора похода');
  assert.ok((await page.getByTestId('life-scene-participants').textContent())?.includes('ведёт обсуждение'), 'Лидер не ведёт разбор');

  stage = 'conflict-setup';
  console.log('Resolving debrief, then checking visible conflict and mediation...');
  for (let hour = 0; hour < 5; hour += 1) await advanceHour(150);
  await page.getByRole('button', { name: 'Открыть внутреннюю модель и события', exact: true }).click();
  await page.getByRole('button', { name: 'Спровоцировать ссору', exact: true }).click();
  await advanceHour(1700);
  await mealPanel.waitFor({ timeout: 8000 });

  stage = 'conflict-panel';
  assert.equal(await mealPanel.getAttribute('data-scene-type'), 'conflict', 'Ссора осталась только записью в журнале');
  const conflictText = await mealPanel.textContent();
  assert.ok(conflictText?.includes('Открытый конфликт'), 'Не показан тип конфликтной сцены');
  assert.ok(conflictText?.includes('посредник'), 'Третий персонаж не вмешался в ссору');

  stage = 'conflict-reactions';
  assert.ok(await page.locator('.rts-scene-reaction').count() >= 2, 'Нет визуальных реакций участников конфликта');
  const sceneActors = await page.locator('[data-scene^="life-"]').all();
  assert.ok(sceneActors.length >= 3, 'Конфликт не собрал участников и посредника на карте');

  stage = 'conflict-spacing';
  const conflictXs = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorNumber(id, 'data-x')));
  assert.ok(Math.max(...conflictXs) - Math.min(...conflictXs) >= 12, 'Участники конфликта не разошлись визуально');

  stage = 'persistence';
  for (let hour = 0; hour < 5; hour += 1) await advanceHour(150);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.waitForTimeout(250);
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2')));
  const sceneTypes = saved.lifeScenes?.scenes?.map((scene) => scene.type) ?? [];
  for (const type of ['meal', 'debrief', 'conflict']) assert.ok(sceneTypes.includes(type), `В сохранении отсутствует визуальная сцена: ${type}`);
  assert.ok(Object.values(saved.heroes).some((hero) => hero.memories.some((memory) => memory.tags?.includes('visual-scene'))), 'Сцены не создали воспоминаний');
  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);

  diagnostic = await snapshot();
  writeFileSync('life-scenes-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostic, pageErrors }, null, 2));
  console.log('Visual daily life browser smoke test passed.');
} catch (error) {
  diagnostic = await snapshot().catch(() => ({}));
  writeFileSync('life-scenes-diagnostics.json', JSON.stringify({
    ok: false,
    stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostic,
    pageErrors,
  }, null, 2));
  console.error('Visual daily life browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'life-scenes-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
