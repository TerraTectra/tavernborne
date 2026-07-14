import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const storageKey = 'tavernborne.world.v2';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
const pageErrors = [];
const failedResponses = [];
const diagnostics = {};
let stage = 'startup';

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()); });
page.on('response', (response) => {
  if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
});

const waitCamp = async () => {
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor({ timeout: 25_000 });
  await page.waitForFunction((key) => Boolean(window.localStorage.getItem(key)), storageKey, { timeout: 20_000 });
};

const storedWorld = () => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), storageKey);

const advanceHour = async () => {
  const previous = (await storedWorld()).tick;
  await page.getByRole('button', { name: '+1 час', exact: true }).click({ noWaitAfter: true });
  await page.waitForFunction(({ key, tick }) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw).tick > tick : false;
  }, { key: storageKey, tick: previous }, { timeout: 20_000 });
  await page.waitForTimeout(260);
};

const configureTraining = async () => {
  await page.evaluate((key) => {
    const world = JSON.parse(window.localStorage.getItem(key));
    const day = Math.floor(world.tick / 24);
    world.routine = { wakeHour: 30, breakfastHour: 31, lunchHour: 32, dinnerHour: 33, sleepHour: 34 };
    world.socialScenes = [];
    world.expeditions = [];
    world.visualScenes = { scenes: [], nextId: 1 };
    world.lifeScenes = {
      scenes: [], nextId: 1, handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    for (const hero of Object.values(world.heroes)) {
      hero.stats.strength = 35;
      hero.stats.endurance = 35;
      hero.stats.dexterity = 35;
      hero.stats.perception = 35;
      hero.traits.discipline = 72;
      hero.traits.curiosity = 72;
      hero.traits.patience = 68;
      hero.traits.courage = 70;
      hero.traits.impulsiveness = 30;
      hero.condition.health = 100;
      hero.condition.injury = 0;
      hero.needs.hunger = 5;
      hero.needs.fatigue = 5;
      hero.needs.social = 5;
      hero.psyche.stress = 5;
      hero.body.tissues.muscleFatigue = 4;
      hero.body.tissues.hydration = 95;
      hero.currentActivity = {
        actionId: 'train', label: 'Оттачивать борьбу, захваты и контроль корпуса',
        startedAt: world.tick, durationHours: 22, remainingHours: 22, source: 'personal',
        planBlockId: `${hero.id}-motor-training`,
      };
      hero.currentAction = {
        actionId: 'train', label: 'Оттачивать борьбу, захваты и контроль корпуса', score: 100,
        reasons: [{ label: 'испытание памяти движений', value: 100 }],
      };
      hero.dailyPlan = [{
        id: `${hero.id}-motor-training`, day, startHour: world.tick % 24, endHour: 23,
        actionId: 'train', label: 'Оттачивать борьбу, захваты и контроль корпуса',
        source: 'personal', status: 'active',
      }];
      hero.planDay = day;
      hero.lastReplanTick = world.tick;
      hero.lastSocialTick = world.tick;
    }
    window.localStorage.setItem(key, JSON.stringify(world));
  }, storageKey);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();
};

const trainBlock = async (hours) => {
  await configureTraining();
  for (let index = 0; index < hours; index += 1) await advanceHour();
};

const motorSnapshot = (world, id) => {
  const hero = world.heroes[id];
  return {
    affinity: hero.body.affinity,
    totalAttempts: hero.body.motorMemory.totalAttempts,
    successfulAttempts: hero.body.motorMemory.successfulAttempts,
    patterns: hero.body.motorMemory.patterns,
    schools: hero.body.motorMemory.schools,
  };
};

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();

  stage = 'natural-affinity';
  const initial = await storedWorld();
  for (const id of ['mira', 'kael', 'liora']) {
    const body = initial.heroes[id].body;
    assert.ok(body.affinity, `${id}: отсутствует природная совместимость тела`);
    assert.equal(Object.keys(body.affinity.movement).length, 8, `${id}: неполный профиль семейств движений`);
    assert.ok(body.motorMemory, `${id}: отсутствует память движений`);
    assert.equal(body.motorMemory.totalAttempts, 0, `${id}: новый герой уже имеет ложные попытки`);
  }
  assert.ok(
    initial.heroes.kael.body.affinity.movement.grapplingControl.aptitude
      > initial.heroes.liora.body.affinity.movement.grapplingControl.aptitude + 8,
    'Тяжёлое устойчивое тело Каэля не получило заметного преимущества в захватах',
  );
  assert.ok(
    initial.heroes.liora.body.affinity.movement.flowingTransition.aptitude
      > initial.heroes.kael.body.affinity.movement.flowingTransition.aptitude + 8,
    'Гибкое координированное тело Лиоры не получило преимущества в текучих переходах',
  );
  diagnostics.initial = {
    mira: motorSnapshot(initial, 'mira'),
    kael: motorSnapshot(initial, 'kael'),
    liora: motorSnapshot(initial, 'liora'),
  };

  stage = 'body-ui';
  const bodyPanel = page.getByTestId('physical-body-panel');
  await bodyPanel.getByRole('button').click();
  await page.getByTestId('physical-body-details').waitFor();
  for (const id of ['mira', 'kael', 'liora']) {
    await page.getByTestId(`body-affinities-${id}`).waitFor();
    await page.getByTestId(`motor-memory-${id}`).waitFor();
  }
  await page.screenshot({ path: 'body-affinity-initial.png', fullPage: true });
  await bodyPanel.getByRole('button').click();

  stage = 'first-practice';
  await trainBlock(6);
  const afterSix = await storedWorld();
  diagnostics.afterSix = {
    kael: motorSnapshot(afterSix, 'kael'),
    liora: motorSnapshot(afterSix, 'liora'),
  };
  for (const id of ['kael', 'liora']) {
    const memory = afterSix.heroes[id].body.motorMemory;
    assert.ok(memory.totalAttempts >= 5, `${id}: тренировка не создала процедурные попытки`);
    assert.ok(memory.patterns.some((pattern) => pattern.family === 'grapplingControl'), `${id}: удачные захваты не запомнились`);
  }
  const earlyKaelBest = [...afterSix.heroes.kael.body.motorMemory.patterns]
    .sort((left, right) => right.mastery - left.mastery)[0];
  assert.ok(earlyKaelBest, 'Каэль не запомнил ни одного движения после первого блока');

  stage = 'refinement';
  await trainBlock(6);
  await trainBlock(6);
  const refined = await storedWorld();
  diagnostics.refined = {
    mira: motorSnapshot(refined, 'mira'),
    kael: motorSnapshot(refined, 'kael'),
    liora: motorSnapshot(refined, 'liora'),
  };

  for (const id of ['mira', 'kael', 'liora']) {
    const memory = refined.heroes[id].body.motorMemory;
    assert.ok(memory.totalAttempts >= 17, `${id}: история попыток не накопилась`);
    assert.ok(memory.successfulAttempts > 0, `${id}: нет ни одной успешной схемы`);
    assert.ok(memory.patterns.length >= 2, `${id}: герой не создал варианты движения`);
    assert.ok(memory.patterns.some((pattern) => pattern.repetitions >= 2), `${id}: лучшие движения не выбираются повторно`);
    assert.ok(memory.schools.length >= 1, `${id}: устойчивые схемы не объединились в личную школу`);
  }

  const lateKaelPattern = refined.heroes.kael.body.motorMemory.patterns.find((pattern) => pattern.id === earlyKaelBest.id);
  assert.ok(lateKaelPattern, 'Раннее удачное движение Каэля исчезло из памяти');
  assert.ok(lateKaelPattern.mastery > earlyKaelBest.mastery, 'Повторение не повысило мастерство запомненного движения');
  assert.ok(lateKaelPattern.repetitions > earlyKaelBest.repetitions, 'Удачное движение не стало повторяться чаще');

  const bestMastery = (id) => Math.max(...refined.heroes[id].body.motorMemory.patterns
    .filter((pattern) => pattern.family === 'grapplingControl')
    .map((pattern) => pattern.mastery));
  assert.ok(bestMastery('kael') > bestMastery('liora'), 'Природная совместимость не повлияла на скорость освоения одинаковой практики');

  stage = 'persisted-ui';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();
  await page.getByTestId('physical-body-panel').getByRole('button').click();
  await page.getByTestId('motor-schools-kael').waitFor();
  await page.getByTestId('motor-memory-kael').waitFor();
  await page.screenshot({ path: 'body-affinity-mastered.png', fullPage: true });

  stage = 'migration';
  await page.evaluate((key) => {
    const world = JSON.parse(window.localStorage.getItem(key));
    delete world.heroes.mira.body.affinity;
    delete world.heroes.mira.body.motorMemory;
    window.localStorage.setItem(key, JSON.stringify(world));
  }, storageKey);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.waitForTimeout(300);
  const migrated = await storedWorld();
  assert.equal(Object.keys(migrated.heroes.mira.body.affinity.movement).length, 8, 'Старое сохранение не получило профиль совместимости');
  assert.equal(migrated.heroes.mira.body.motorMemory.totalAttempts, 0, 'Миграция создала ложную двигательную историю');
  diagnostics.migratedMira = motorSnapshot(migrated, 'mira');

  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `HTTP-ошибки: ${failedResponses.map((item) => `${item.status} ${item.url}`).join(' | ')}`);

  writeFileSync('body-affinity-motor-diagnostics.json', JSON.stringify({ stage: 'passed', diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Body affinity and motor memory browser smoke passed.');
} catch (error) {
  writeFileSync('body-affinity-motor-diagnostics.json', JSON.stringify({
    stage,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    diagnostics,
    pageErrors,
    failedResponses,
  }, null, 2));
  console.error('Body affinity and motor memory browser smoke failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'body-affinity-motor-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
