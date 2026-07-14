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

const resetErrors = () => {
  pageErrors.length = 0;
  failedResponses.length = 0;
};

const storedWorld = () => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), storageKey);

const waitCamp = async () => {
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor({ timeout: 25_000 });
  await page.waitForFunction((key) => Boolean(window.localStorage.getItem(key)), storageKey, { timeout: 20_000 });
  await page.getByTestId('physical-body-panel').waitFor({ timeout: 20_000 });
};

const openBodies = async () => {
  const panel = page.getByTestId('physical-body-panel');
  const details = page.getByTestId('physical-body-details');
  if (!(await details.isVisible().catch(() => false))) await panel.getByRole('button').click();
  await details.waitFor({ timeout: 20_000 });
};

const waitMotionSaved = async (heroId, tick) => {
  await page.waitForFunction(({ key, heroId, tick }) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const world = JSON.parse(raw);
    return world.heroes?.[heroId]?.body?.proceduralMotion?.lastSynchronizedTick === tick;
  }, { key: storageKey, heroId, tick }, { timeout: 20_000 });
};

const identicalPattern = (heroId, forceCommitment = 0.72, recoveryPriority = 0.72) => ({
  id: `motion-test-${heroId}`,
  family: 'flowingTransition',
  purpose: 'mobility',
  name: 'испытательная текучая связка',
  discoveredAt: 1,
  lastPracticedTick: 10,
  dominantSide: 'right',
  parameters: {
    stanceWidthRatio: 1.22,
    weightTransfer: 0.62,
    hipRotationDeg: 48,
    reachExtension: 0.72,
    tempo: 0.74,
    forceCommitment,
    recoveryPriority,
  },
  repetitions: 12,
  successes: 10,
  failures: 2,
  bestQuality: 82,
  averageQuality: 74,
  mastery: 38,
  reliability: 76,
  efficiency: 72,
  strain: 18,
});

const injectTraining = async ({ unstableLiora = false } = {}) => {
  await page.evaluate(({ key, unstableLiora }) => {
    const world = JSON.parse(window.localStorage.getItem(key));
    world.tick = 10;
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
      hero.condition.health = 100;
      hero.condition.injury = 0;
      hero.needs.fatigue = 5;
      hero.psyche.stress = 5;
      hero.body.tissues.muscleFatigue = 8;
      hero.body.tissues.hydration = 95;
      for (const segment of Object.values(hero.body.segments)) segment.pain = 0;
      hero.body.motorMemory.patterns = [{
        id: `motion-test-${hero.id}`,
        family: 'flowingTransition',
        purpose: 'mobility',
        name: 'испытательная текучая связка',
        discoveredAt: 1,
        lastPracticedTick: 10,
        dominantSide: 'right',
        parameters: {
          stanceWidthRatio: 1.22,
          weightTransfer: 0.62,
          hipRotationDeg: 48,
          reachExtension: 0.72,
          tempo: 0.74,
          forceCommitment: 0.72,
          recoveryPriority: 0.72,
        },
        repetitions: 12,
        successes: 10,
        failures: 2,
        bestQuality: 82,
        averageQuality: 74,
        mastery: 38,
        reliability: 76,
        efficiency: 72,
        strain: 18,
      }];
      hero.currentActivity = {
        actionId: 'train', label: 'Отрабатывать текучие переходы и контроль опоры',
        startedAt: world.tick, durationHours: 3, remainingHours: 3, source: 'personal',
      };
      hero.currentAction = {
        actionId: 'train', label: 'Отрабатывать текучие переходы и контроль опоры', score: 100,
        reasons: [{ label: 'испытание процедурной кинематики', value: 100 }],
      };
      delete hero.body.proceduralMotion;
    }
    if (unstableLiora) {
      const hero = world.heroes.liora;
      hero.body.affinity.stability = 4;
      hero.body.affinity.recovery = 5;
      hero.body.nervous.balance = 3;
      hero.body.pose.stability = 4;
      hero.body.tissues.muscleFatigue = 99;
      for (const segment of Object.values(hero.body.segments)) segment.pain = 72;
      hero.body.motorMemory.patterns[0].parameters.forceCommitment = 0.98;
      hero.body.motorMemory.patterns[0].parameters.recoveryPriority = 0.25;
      hero.body.motorMemory.patterns[0].parameters.tempo = 0.96;
    }
    window.localStorage.setItem(key, JSON.stringify(world));
  }, { key: storageKey, unstableLiora });
  resetErrors();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();
  await waitMotionSaved('mira', 10);
  await waitMotionSaved('kael', 10);
  await waitMotionSaved('liora', 10);
};

const validateMotion = (hero, label) => {
  const motion = hero.body.proceduralMotion;
  assert.ok(motion, `${label}: процедурное движение не сохранено`);
  assert.equal(motion.version, 1, `${label}: неверная версия движения`);
  assert.equal(motion.trajectory.length, 6, `${label}: цикл не содержит шесть фаз`);
  assert.ok(Number.isFinite(motion.balanceMargin), `${label}: запас равновесия не рассчитан`);
  assert.ok(Number.isFinite(motion.fallRisk), `${label}: риск падения не рассчитан`);
  assert.ok(motion.contacts.some((contact) => contact.active), `${label}: нет активных контактов`);
  for (const frame of motion.trajectory) {
    assert.ok(frame.contacts.length >= 4, `${label}: неполная карта контактов`);
    assert.ok(Number.isFinite(frame.centerOfMass.x) && Number.isFinite(frame.centerOfMass.y), `${label}: сломан центр тяжести`);
    for (const [jointId, target] of Object.entries(frame.jointTargets)) {
      const joint = hero.body.joints[jointId];
      assert.ok(target >= joint.minAngleDeg - 0.01, `${label}: ${jointId} вышел ниже предела`);
      assert.ok(target <= joint.maxAngleDeg + 0.01, `${label}: ${jointId} вышел выше предела`);
    }
  }
  return motion;
};

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();
  await openBodies();

  stage = 'initial-bridge';
  const initialTick = (await storedWorld()).tick;
  await waitMotionSaved('mira', initialTick);
  const initial = await storedWorld();
  assert.ok(initial.heroes.mira.body.proceduralMotion, 'Начальный мир не получил процедурное состояние');

  stage = 'stable-cycle';
  await injectTraining();
  await openBodies();
  const stable = await storedWorld();
  const miraMotion = validateMotion(stable.heroes.mira, 'Мира');
  const kaelMotion = validateMotion(stable.heroes.kael, 'Каэль');
  const lioraMotion = validateMotion(stable.heroes.liora, 'Лиора');
  assert.equal(miraMotion.active, true, 'Тренировка Миры не активировала цикл');
  assert.notEqual(kaelMotion.supportFoot, 'none', 'Стабильное тело Каэля потеряло все опоры');
  assert.ok(kaelMotion.fallRisk < lioraMotion.fallRisk + 20, 'Устойчивость тела не влияет на риск движения');
  diagnostics.stable = {
    mira: miraMotion,
    kael: kaelMotion,
    liora: lioraMotion,
  };

  for (const id of ['mira', 'kael', 'liora']) {
    const panel = page.getByTestId(`procedural-motion-${id}`);
    await panel.waitFor({ timeout: 20_000 });
    assert.equal(await panel.getAttribute('data-motion-frame-count'), '6', `${id}: UI не получил траекторию`);
    assert.notEqual(await panel.getAttribute('data-motion-contacts'), 'none', `${id}: UI не показывает контакты`);
  }

  const motionPanel = page.getByTestId('procedural-motion-kael');
  const firstPhase = await motionPanel.getAttribute('data-motion-phase');
  await page.waitForTimeout(1500);
  const secondPhase = await motionPanel.getAttribute('data-motion-phase');
  assert.notEqual(secondPhase, firstPhase, 'Полупроцедурный SVG-риг не проходит по фазам движения');
  await page.screenshot({ path: 'procedural-motion-stable.png', fullPage: true });

  stage = 'loss-of-balance';
  await injectTraining({ unstableLiora: true });
  await openBodies();
  const unstable = await storedWorld();
  const unstableMotion = validateMotion(unstable.heroes.liora, 'Лиора после перегрузки');
  assert.equal(unstableMotion.unstable, true, 'Крайне слабая опора не вызвала потерю равновесия');
  assert.ok(unstableMotion.fallRisk >= 66, 'Риск падения не вырос при перегрузке');
  assert.ok(unstable.heroes.liora.body.tissues.muscleFatigue >= 99, 'Восстановительный шаг не увеличил нагрузку');
  if (unstableMotion.fallen) {
    assert.ok(unstable.heroes.liora.condition.injury > 0, 'Падение не повлияло на травму');
    assert.equal(unstable.heroes.liora.body.pose.name, 'injured', 'Падение не изменило позу тела');
  }
  const unstablePanel = page.getByTestId('procedural-motion-liora');
  assert.equal(await unstablePanel.getAttribute('data-motion-unstable'), 'true', 'UI скрывает потерю равновесия');
  diagnostics.unstable = unstableMotion;
  await page.screenshot({ path: 'procedural-motion-unstable.png', fullPage: true });

  stage = 'migration';
  await page.evaluate((key) => {
    const world = JSON.parse(window.localStorage.getItem(key));
    world.tick = 16;
    delete world.heroes.mira.body.proceduralMotion;
    window.localStorage.setItem(key, JSON.stringify(world));
  }, storageKey);
  resetErrors();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();
  await waitMotionSaved('mira', 16);
  await page.waitForTimeout(1200);
  const migrated = await storedWorld();
  assert.equal(migrated.heroes.mira.body.proceduralMotion.version, 1, 'Старое сохранение не получило процедурное движение');
  assert.equal(migrated.heroes.mira.body.proceduralMotion.trajectory.length, 6, 'Миграция создала неполную траекторию');
  diagnostics.migrated = migrated.heroes.mira.body.proceduralMotion;

  assert.equal(pageErrors.length, 0, `Ошибки стабильной страницы: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `HTTP-ошибки стабильной страницы: ${failedResponses.map((item) => `${item.status} ${item.url}`).join(' | ')}`);

  writeFileSync('procedural-motion-diagnostics.json', JSON.stringify({ stage: 'passed', diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Procedural motion foundation browser smoke passed.');
} catch (error) {
  writeFileSync('procedural-motion-diagnostics.json', JSON.stringify({
    stage,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    diagnostics,
    pageErrors,
    failedResponses,
  }, null, 2));
  console.error('Procedural motion foundation browser smoke failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'procedural-motion-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
