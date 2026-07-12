import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1750, height: 1100 } });
const pageErrors = [];
let stage = 'boot';
let snapshots = {};

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const advanceHour = async (wait = 430) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click();
  await page.waitForTimeout(wait);
};

const savedWorld = () => page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2')));
const bodySnapshot = (world, id) => ({
  tick: world.tick,
  activity: world.heroes[id].currentActivity,
  condition: world.heroes[id].condition,
  anthropometry: world.heroes[id].body.anthropometry,
  tissues: world.heroes[id].body.tissues,
  pose: world.heroes[id].body.pose,
  painfulSegments: Object.values(world.heroes[id].body.segments)
    .filter((segment) => segment.pain > 0)
    .map((segment) => ({ id: segment.id, pain: segment.pain, health: segment.health })),
});

try {
  stage = 'open';
  console.log(`Opening physical body simulation at ${testUrl}...`);
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await page.waitForTimeout(700);

  stage = 'rig';
  console.log('Checking unique articulated rigs...');
  const expected = {
    mira: { height: 169, mass: 63 },
    kael: { height: 183, mass: 84 },
    liora: { height: 162, mass: 52 },
  };
  for (const [id, body] of Object.entries(expected)) {
    const actor = page.getByTestId(`actor-${id}`);
    await actor.waitFor();
    assert.equal(Number(await actor.getAttribute('data-height-cm')), body.height, `${id}: неверный рост`);
    assert.equal(Number(await actor.getAttribute('data-mass-kg')), body.mass, `${id}: неверная масса`);
    const rig = page.getByTestId(`physical-rig-${id}`);
    await rig.waitFor();
    assert.equal(await rig.locator('[data-body-segment]').count(), 17, `${id}: суставной риг не содержит 17 сегментов`);
  }
  assert.ok(Number(await page.getByTestId('actor-kael').getAttribute('data-height-cm')) > Number(await page.getByTestId('actor-mira').getAttribute('data-height-cm')), 'Каэль визуально не выше Миры');
  assert.ok(Number(await page.getByTestId('actor-mira').getAttribute('data-height-cm')) > Number(await page.getByTestId('actor-liora').getAttribute('data-height-cm')), 'Мира визуально не выше Лиоры');

  stage = 'panel';
  console.log('Checking body inspection panel and persisted anatomy...');
  const bodyPanel = page.getByTestId('physical-body-panel');
  await bodyPanel.waitFor();
  await bodyPanel.getByRole('button').click();
  await page.getByTestId('physical-body-details').waitFor();
  for (const id of Object.keys(expected)) await page.getByTestId(`body-card-${id}`).waitFor();
  await page.screenshot({ path: 'physical-body-rig.png', fullPage: true });
  await bodyPanel.getByRole('button').click();

  await page.getByTestId('actor-liora').click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.waitForTimeout(300);
  const initial = await savedWorld();
  snapshots.initial = bodySnapshot(initial, 'liora');
  for (const id of Object.keys(expected)) {
    assert.equal(initial.heroes[id].body.version, 1, `${id}: версия тела не сохранена`);
    assert.equal(Object.keys(initial.heroes[id].body.segments).length, 17, `${id}: сегменты не сохранены`);
    assert.equal(Object.keys(initial.heroes[id].body.joints).length, 14, `${id}: суставы не сохранены`);
  }
  const initialLioraMuscle = initial.heroes.liora.body.anthropometry.muscleMassKg;
  const initialLioraFatigue = initial.heroes.liora.body.tissues.muscleFatigue;

  stage = 'training';
  console.log('Advancing Liora into her afternoon training block...');
  for (let hour = 0; hour < 9; hour += 1) await advanceHour(520);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.waitForTimeout(300);
  const trained = await savedWorld();
  snapshots.trained = bodySnapshot(trained, 'liora');
  assert.equal(trained.heroes.liora.currentActivity?.actionId, 'train', 'Лиора не начала запланированную тренировку');
  assert.ok(trained.heroes.liora.body.anthropometry.muscleMassKg > initialLioraMuscle, 'Тренировка не изменила мышечную адаптацию');
  assert.ok(trained.heroes.liora.body.tissues.muscleFatigue > initialLioraFatigue, 'Тренировка не повысила мышечную усталость');
  assert.equal(trained.heroes.liora.body.pose.name, 'training', 'Тело не приняло тренировочную позу');

  stage = 'injury';
  console.log('Checking injury propagation into body segments...');
  await page.getByRole('button', { name: 'Открыть внутреннюю модель и события', exact: true }).click();
  await page.getByRole('button', { name: 'Вернуть с травмой', exact: true }).click();
  await advanceHour(600);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.waitForTimeout(300);
  const injured = await savedWorld();
  snapshots.injured = bodySnapshot(injured, 'liora');
  const painfulSegments = Object.values(injured.heroes.liora.body.segments).filter((segment) => segment.pain >= 2);
  assert.ok(injured.heroes.liora.condition.injury > 0, 'Испытательное событие не создало травму');
  assert.ok(painfulSegments.length >= 1, 'Общая травма не распространилась на конкретные сегменты тела');

  stage = 'migration';
  console.log('Checking migration of a save without physical bodies...');
  await page.evaluate(() => {
    const world = JSON.parse(window.localStorage.getItem('tavernborne.world.v2'));
    delete world.heroes.mira.body;
    window.localStorage.setItem('tavernborne.world.v2', JSON.stringify(world));
  });
  await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.waitForTimeout(250);
  const migrated = await savedWorld();
  snapshots.migratedMira = bodySnapshot(migrated, 'mira');
  assert.equal(migrated.heroes.mira.body.version, 1, 'Старое сохранение не получило тело при гидратации');
  assert.equal(Object.keys(migrated.heroes.mira.body.segments).length, 17, 'Миграция не восстановила сегменты');
  assert.equal(Object.keys(migrated.heroes.mira.body.joints).length, 14, 'Миграция не восстановила суставы');
  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);

  fs.writeFileSync('physical-body-diagnostics.json', JSON.stringify({ stage: 'passed', snapshots, pageErrors }, null, 2));
  console.log('Physical body browser smoke test passed.');
} catch (error) {
  fs.writeFileSync('physical-body-diagnostics.json', JSON.stringify({
    stage,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    snapshots,
    pageErrors,
  }, null, 2));
  console.error('Physical body browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'physical-body-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
