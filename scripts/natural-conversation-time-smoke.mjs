import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const storageKey = 'tavernborne.world.v2';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const pageErrors = [];
const failedResponses = [];
const diagnostics = {};
let stage = 'startup';

await page.addInitScript(() => {
  const nativeSetInterval = window.setInterval.bind(window);
  window.__tavernborneIntervalDelays = [];
  window.setInterval = (handler, delay, ...args) => {
    window.__tavernborneIntervalDelays.push(Number(delay));
    return nativeSetInterval(handler, delay, ...args);
  };
});

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()); });
page.on('response', (response) => {
  if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
});

const waitStoredWorld = async () => page.waitForFunction(
  (key) => Boolean(window.localStorage.getItem(key)),
  storageKey,
  { timeout: 20_000 },
);

const waitCamp = async () => {
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor({ timeout: 25_000 });
  await waitStoredWorld();
};

const storedWorld = () => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), storageKey);

const advanceHour = async () => {
  const previousTick = (await storedWorld()).tick;
  await page.getByRole('button', { name: '+1 час', exact: true }).click({ noWaitAfter: true });
  await page.waitForFunction(
    ({ key, before }) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw).tick > before : false;
    },
    { key: storageKey, before: previousTick },
    { timeout: 20_000 },
  );
  await page.waitForTimeout(400);
};

const injectConversation = async (mode) => {
  await page.evaluate(({ key, scenario }) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error('Base Tavernborne world is not stored');
    const world = JSON.parse(raw);
    const relation = (hero, targetId, values) => {
      hero.relationships[targetId] ??= {
        targetId,
        values: {
          liking: 0, trust: 0, respect: 0, closeness: 0, fear: 0,
          resentment: 0, envy: 0, attraction: 0, debt: 0, rivalry: 0,
        },
      };
      Object.assign(hero.relationships[targetId].values, values);
    };
    const memory = (hero, otherId, id, importance, valence = 30) => {
      hero.memories.push({
        id, summary: 'Оба понимают, что эта тема касается их будущего.', createdAt: 8,
        importance, valence, participants: [otherId], tags: ['shared', 'important'], sourceEventType: 'social',
      });
    };

    world.tick = 10;
    world.journal = [];
    world.socialScenes = [];
    world.expeditions = [{
      id: 'completed-day-zero', day: 0, floor: 1, partyIds: [], departTick: 0,
      plannedReturnTick: 1, status: 'completed', progress: 100, risk: 0, loot: [], events: [],
      outcome: 'Технически завершённая экспедиция для изоляции разговора',
    }];
    world.routine = { wakeHour: 6, breakfastHour: 6, lunchHour: 16, dinnerHour: 21, sleepHour: 23 };
    world.visualScenes = { scenes: [], nextId: 1 };
    world.lifeScenes = {
      scenes: [], nextId: 1, handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    delete world.commitmentReasoning;
    delete world.commitmentNegotiations;
    delete world.conversationConsequences;

    for (const hero of Object.values(world.heroes)) {
      hero.currentAction = undefined;
      hero.currentActivity = undefined;
      hero.dailyPlan = [{
        id: `${hero.id}-placeholder`, day: 0, startHour: 0, endHour: 1,
        actionId: 'read', label: 'Технический завершённый блок', source: 'personal', status: 'done',
      }];
      hero.planDay = 0;
      hero.lastReplanTick = 10;
      hero.lastSocialTick = -99;
      hero.memories = [];
      hero.condition.health = 100;
      hero.condition.injury = 0;
      hero.needs.hunger = 10;
      hero.needs.fatigue = 15;
      hero.needs.solitude = 10;
      hero.needs.social = 55;
      Object.keys(hero.emotions).forEach((name) => { hero.emotions[name] = 0; });
      Object.keys(hero.psyche).forEach((name) => { hero.psyche[name] = name === 'security' ? 80 : 10; });
    }

    const mira = world.heroes.mira;
    const kael = world.heroes.kael;
    if (!mira || !kael) throw new Error('Smoke scenario requires Mira and Kael');

    relation(mira, 'kael', { liking: 28, trust: 30, respect: 24, closeness: 26, resentment: 0, fear: 0 });
    relation(kael, 'mira', { liking: 28, trust: 30, respect: 24, closeness: 26, resentment: 0, fear: 0 });
    mira.traits.friendliness = 70;
    mira.traits.honesty = 72;
    mira.traits.courage = 68;
    mira.traits.caution = 25;
    mira.psyche.confidence = 70;
    kael.traits.friendliness = 65;
    kael.traits.patience = 65;
    kael.traits.empathy = 65;

    let label = 'Вечернее общение';
    let reason = 'просто провести немного времени вместе';
    let source = 'group';
    let groupId = 'casual-evening';

    if (scenario !== 'casual') {
      label = 'Обсудить страх перед новым походом и безопасность семьи';
      reason = 'решить, как оба будут действовать в следующем опасном походе';
      source = 'replan';
      groupId = `important-${scenario}`;
      mira.emotions.anxiety = 72;
      memory(mira, 'kael', `mira-${scenario}-shared-memory`, 92, 42);
    }

    if (scenario === 'important-direct' || scenario === 'important-guarded') {
      memory(kael, 'mira', `kael-${scenario}-shared-memory`, 92, 42);
      kael.dailyPlan.push({
        id: `kael-${scenario}-shared-plan`, day: 0, startHour: 10, endHour: 11,
        actionId: 'talk', label, source: 'group', status: 'active', targetId: 'mira', groupId,
      });
    }

    if (scenario === 'important-direct') {
      relation(mira, 'kael', { liking: 58, trust: 68, respect: 60, closeness: 64, resentment: 0, fear: 0 });
      relation(kael, 'mira', { liking: 58, trust: 68, respect: 60, closeness: 64, resentment: 0, fear: 0 });
      mira.traits.honesty = 92;
      mira.traits.courage = 90;
      mira.traits.friendliness = 84;
      mira.traits.caution = 8;
      mira.emotions.anxiety = 10;
      mira.psyche.confidence = 88;
    }

    if (scenario === 'important-guarded') {
      relation(mira, 'kael', { liking: -8, trust: -15, respect: 5, closeness: 4, resentment: 72, fear: 28 });
      relation(kael, 'mira', { liking: -8, trust: -15, respect: 5, closeness: 4, resentment: 72, fear: 28 });
      mira.traits.honesty = 50;
      mira.traits.courage = 35;
      mira.traits.caution = 92;
      mira.emotions.anxiety = 75;
      mira.psyche.confidence = 25;
    }

    const planId = `mira-${scenario}-talk-plan`;
    mira.dailyPlan.push({
      id: planId, day: 0, startHour: 10, endHour: 11,
      actionId: 'talk', label, source, status: 'active', targetId: 'kael', groupId, reason,
      socialSceneId: `social-${scenario}`,
    });

    world.socialScenes.push({
      id: `social-${scenario}`, actionId: 'talk', initiatorId: 'mira', targetId: 'kael',
      createdAt: 10, status: 'active', response: 'accepted', remainingHours: 1,
      planBlockIds: [planId],
      lines: [
        { id: `social-${scenario}-line-0`, tick: 10, speakerId: 'mira', text: 'Каэль, найдётся время поговорить у очага?', tone: 'warm' },
        { id: `social-${scenario}-line-1`, tick: 10, speakerId: 'kael', text: 'Давай. У меня как раз есть время.', tone: 'warm' },
      ],
      reason,
    });

    window.localStorage.setItem(key, JSON.stringify(world));
  }, { key: storageKey, scenario: mode });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();
};

const runConversationScenario = async (mode, expectedKind, expectedDirectInvitation) => {
  await injectConversation(mode);
  await advanceHour();
  const world = await storedWorld();
  const scene = world.socialScenes.find((candidate) => candidate.id === `social-${mode}`);
  assert.ok(scene, `${mode}: social scene is missing`);
  assert.equal(scene.naturalConversation?.kind, expectedKind, `${mode}: wrong conversation kind`);
  assert.equal(scene.naturalConversation?.directInvitation, expectedDirectInvitation, `${mode}: wrong direct invitation decision`);
  const opening = scene.lines[0]?.text ?? '';
  const exactInvitation = /давай\s+поговорим/iu.test(opening);
  assert.equal(exactInvitation, expectedDirectInvitation, `${mode}: exact invitation phrase policy failed: ${opening}`);
  if (expectedKind === 'casual') {
    assert.doesNotMatch(opening, /нужно\s+поговорить|найд[её]тся\s+время\s+поговорить|несколько\s+слов/iu);
    assert.match(opening, /как|что|день/iu);
  }
  if (expectedKind === 'important') {
    assert.ok(scene.naturalConversation.initiatorImportance >= 56);
    assert.ok(scene.naturalConversation.targetImportance >= 56);
  }
  const life = world.lifeScenes?.scenes?.find((candidate) => candidate.sourceSocialSceneId === scene.id);
  assert.ok(life, `${mode}: life scene is missing`);
  assert.equal(life.title, expectedKind === 'casual' ? 'Повседневная беседа' : expectedKind === 'personal' ? 'Личный разговор' : 'Важный разговор');
  if (expectedKind === 'casual') {
    const fullDialogue = life.dialogue.map((line) => line.text).join(' ');
    assert.doesNotMatch(fullDialogue, /давай\s+поговорим|мне\s+нужно\s+сказать\s+тебе\s+несколько\s+слов|я\s+не\s+требую\s+ответа/iu);
  }
  diagnostics[mode] = {
    metadata: scene.naturalConversation,
    opening,
    response: scene.lines[1]?.text,
    title: life.title,
    dialogue: life.dialogue.map((line) => line.text),
  };
  await page.screenshot({ path: `natural-conversation-${mode}.png`, fullPage: true });
};

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();

  stage = 'time-scale';
  const scale = page.getByTestId('time-scale');
  await scale.waitFor();
  assert.equal(await scale.getAttribute('data-realtime-ms'), '300000');
  assert.match((await scale.textContent()) ?? '', /5\s+мин/iu);
  await page.getByRole('button', { name: 'Запустить', exact: true }).click();
  await page.waitForTimeout(150);
  const intervalDelays = await page.evaluate(() => window.__tavernborneIntervalDelays ?? []);
  assert.ok(intervalDelays.includes(300000), `Realtime interval 300000ms was not registered: ${intervalDelays.join(', ')}`);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.getByRole('button', { name: 'x1', exact: true }).click();
  assert.equal(await scale.getAttribute('data-realtime-ms'), '150000');
  assert.match((await scale.textContent()) ?? '', /2:30/iu);
  await page.getByRole('button', { name: 'x2', exact: true }).click();
  assert.equal(await scale.getAttribute('data-realtime-ms'), '75000');
  await page.getByRole('button', { name: 'x4', exact: true }).click();
  assert.equal(await scale.getAttribute('data-realtime-ms'), '300000');
  diagnostics.timeScale = { intervalDelays, x1: 300000, x2: 150000, x4: 75000 };

  stage = 'casual';
  await runConversationScenario('casual', 'casual', false);

  stage = 'personal';
  await runConversationScenario('personal', 'personal', false);

  stage = 'important-direct';
  await runConversationScenario('important-direct', 'important', true);

  stage = 'important-guarded';
  await runConversationScenario('important-guarded', 'important', false);

  stage = 'persistence';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitStoredWorld();
  const persisted = await storedWorld();
  const persistedScene = persisted.socialScenes.find((candidate) => candidate.id === 'social-important-guarded');
  assert.equal(persistedScene?.naturalConversation?.kind, 'important');
  assert.equal(persistedScene?.naturalConversation?.directInvitation, false);

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `Failed responses: ${failedResponses.map((entry) => `${entry.status} ${entry.url}`).join(' | ')}`);
  writeFileSync('natural-conversation-time-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Natural conversation and realtime scale browser smoke passed.');
} catch (error) {
  writeFileSync('natural-conversation-time-diagnostics.json', JSON.stringify({
    ok: false,
    stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics,
    pageErrors,
    failedResponses,
  }, null, 2));
  console.error('Natural conversation and realtime scale browser smoke failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'natural-conversation-time-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
