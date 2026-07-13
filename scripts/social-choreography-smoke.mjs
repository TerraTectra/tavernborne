import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const pageErrors = [];
const failedResponses = [];
const diagnostics = {};
let stage = 'startup';

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});
page.on('response', (response) => {
  if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
});

const waitRigged = async (id) => {
  await page.getByTestId(`hero-3d-${id}`).waitFor({ timeout: 25_000 });
  await page.waitForFunction(
    (heroId) => document.querySelector(`[data-testid="hero-3d-${heroId}"]`)?.getAttribute('data-visual-mode') === 'rigged-asset',
    id,
    { timeout: 25_000 },
  );
};

const waitFormation = async (ids, formation) => {
  await page.waitForFunction(
    ({ heroIds, expectedFormation }) => heroIds.every((heroId) => {
      const label = document.querySelector(`[data-testid="hero-3d-${heroId}"]`);
      const probe = document.querySelector(`[data-testid="interaction-${heroId}"]`);
      return label?.getAttribute('data-choreography-formation') === expectedFormation
        && probe?.getAttribute('data-choreography-formation') === expectedFormation
        && probe?.getAttribute('data-interaction-contact') === 'active';
    }),
    { heroIds: ids, expectedFormation: formation },
    { timeout: 30_000 },
  );
};

const heroState = async (id) => {
  const label = page.getByTestId(`hero-3d-${id}`);
  const probe = page.getByTestId(`interaction-${id}`);
  return {
    id,
    x: Number(await label.getAttribute('data-world-x')),
    y: Number(await label.getAttribute('data-world-y')),
    facing: await label.getAttribute('data-facing'),
    formation: await label.getAttribute('data-choreography-formation'),
    distance: await label.getAttribute('data-choreography-distance'),
    gesture: await label.getAttribute('data-choreography-gesture'),
    slot: Number(await label.getAttribute('data-choreography-slot')),
    bubbleLane: Number(await label.getAttribute('data-bubble-lane')),
    partnerId: await label.getAttribute('data-partner-id'),
    focusPoint: await label.getAttribute('data-focus-point'),
    posture: await label.getAttribute('data-interaction-posture'),
    animation: await label.getAttribute('data-animation'),
    probeGesture: await probe.getAttribute('data-choreography-gesture'),
  };
};

const distance = (left, right) => Math.hypot(right.x - left.x, right.y - left.y);
const minPairDistance = (states) => {
  let minimum = Number.POSITIVE_INFINITY;
  states.forEach((left, index) => states.slice(index + 1).forEach((right) => {
    minimum = Math.min(minimum, distance(left, right));
  }));
  return minimum;
};

const resetHeroActivities = (world) => {
  for (const hero of Object.values(world.heroes)) {
    hero.currentAction = undefined;
    hero.currentActivity = undefined;
  }
};

const forceLifeScene = async (scene, socialScenes = []) => {
  await page.evaluate(({ nextScene, nextSocialScenes }) => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    world.visualScenes = { scenes: [], nextId: 1 };
    world.lifeScenes = {
      activeSceneId: nextScene.id,
      scenes: [nextScene],
      nextId: 2,
      handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    world.socialScenes = nextSocialScenes;
    for (const hero of Object.values(world.heroes)) {
      hero.currentAction = undefined;
      hero.currentActivity = undefined;
    }
    window.localStorage.setItem(key, JSON.stringify(world));
  }, { nextScene: scene, nextSocialScenes: socialScenes });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await Promise.all(['mira', 'kael', 'liora'].map(waitRigged));
};

const forceVisualScene = async (phase) => {
  await page.evaluate((nextPhase) => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    world.lifeScenes = {
      scenes: [], nextId: 1, handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    for (const hero of Object.values(world.heroes)) {
      hero.currentAction = undefined;
      hero.currentActivity = undefined;
    }
    world.visualScenes = {
      activeSceneId: 'choreo-council',
      nextId: 2,
      scenes: [{
        id: 'choreo-council', type: 'expeditionCouncil', title: 'Проверка групповой хореографии',
        status: 'active', phase: nextPhase, createdAt: world.tick, updatedAt: world.tick,
        expeditionId: 'choreo-expedition', leaderId: 'mira',
        participantIds: ['mira', 'kael', 'liora'], partyIds: ['mira', 'kael', 'liora'],
        roles: { mira: 'leader', kael: 'vanguard', liora: 'support' },
        responses: { mira: 'accepted', kael: 'accepted', liora: 'accepted' },
        dialogue: [{
          id: `choreo-${nextPhase}`, phase: nextPhase, speakerId: 'liora',
          text: nextPhase === 'departure' ? 'Строй держим вместе.' : 'Сначала проверим роли и маршрут.',
          tone: 'firm',
        }],
        currentLineIndex: 0,
      }],
    };
    window.localStorage.setItem(key, JSON.stringify(world));
  }, phase);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await Promise.all(['mira', 'kael', 'liora'].map(waitRigged));
};

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await Promise.all(['mira', 'kael', 'liora'].map(waitRigged));

  stage = 'pair-conversation';
  await forceLifeScene({
    id: 'choreo-conversation', type: 'conversation', title: 'Разговор', status: 'active', phase: 'exchange',
    createdAt: 10, updatedAt: 10, participantIds: ['mira', 'kael'],
    roles: { mira: 'initiator', kael: 'target' },
    dialogue: [{ id: 'line-conversation', phase: 'exchange', speakerId: 'mira', text: 'Поговорим спокойно.', tone: 'warm' }],
    currentLineIndex: 0, initiatorId: 'mira', targetId: 'kael', sourceSocialSceneId: 'social-accepted',
  }, [{ id: 'social-accepted', initiatorId: 'mira', targetId: 'kael', actionId: 'talk', response: 'accepted', lines: [] }]);
  await waitFormation(['mira', 'kael'], 'pair');
  const pair = await Promise.all(['mira', 'kael'].map(heroState));
  diagnostics.pair = pair;
  assert.ok(distance(pair[0], pair[1]) >= 10 && distance(pair[0], pair[1]) <= 14, 'Conversation pair distance is outside the readable social range.');
  assert.equal(pair[0].partnerId, 'kael');
  assert.equal(pair[1].partnerId, 'mira');
  assert.equal(pair[0].facing, 'right');
  assert.equal(pair[1].facing, 'left');
  assert.deepEqual(pair.map((state) => state.bubbleLane), [-1, 1]);
  assert.equal(pair[0].gesture, 'present');
  assert.equal(pair[1].gesture, 'receive');
  assert.equal(pair[0].animation, 'Idle_Talking_Loop');
  await page.screenshot({ path: 'social-choreography-pair.png', fullPage: true });

  stage = 'treatment';
  await forceLifeScene({
    id: 'choreo-treatment', type: 'treatment', title: 'Лечение', status: 'active', phase: 'action',
    createdAt: 20, updatedAt: 20, participantIds: ['liora', 'kael'],
    roles: { liora: 'healer', kael: 'patient' },
    dialogue: [{ id: 'line-treatment', phase: 'action', speakerId: 'liora', text: 'Не двигайся, я затяну повязку.', tone: 'firm' }],
    currentLineIndex: 0, initiatorId: 'liora', targetId: 'kael',
  });
  await waitFormation(['liora', 'kael'], 'care');
  const care = await Promise.all(['liora', 'kael'].map(heroState));
  diagnostics.care = care;
  assert.ok(distance(care[0], care[1]) >= 6 && distance(care[0], care[1]) <= 8, 'Healer is not positioned beside the patient.');
  assert.equal(care[0].gesture, 'heal');
  assert.equal(care[0].posture, 'kneeling');
  assert.equal(care[1].gesture, 'receive');
  assert.equal(care[1].posture, 'resting');
  assert.equal(care[1].animation, 'Sitting_Idle_Loop');
  assert.equal(care[0].facing, 'right');
  assert.equal(care[1].facing, 'left');
  await page.screenshot({ path: 'social-choreography-treatment.png', fullPage: true });

  stage = 'conflict';
  await forceLifeScene({
    id: 'choreo-conflict', type: 'conflict', title: 'Конфликт', status: 'active', phase: 'exchange',
    createdAt: 30, updatedAt: 30, participantIds: ['mira', 'kael', 'liora'],
    roles: { mira: 'initiator', kael: 'target', liora: 'mediator' },
    dialogue: [{ id: 'line-conflict', phase: 'exchange', speakerId: 'mira', text: 'Ты снова нарушил договорённость.', tone: 'angry' }],
    currentLineIndex: 0, initiatorId: 'mira', targetId: 'kael', mediatorId: 'liora',
  });
  await waitFormation(['mira', 'kael', 'liora'], 'conflict');
  const conflictStates = await Promise.all(['mira', 'kael', 'liora'].map(heroState));
  diagnostics.conflict = conflictStates;
  assert.deepEqual(conflictStates.map((state) => state.gesture), ['argue', 'recoil', 'mediate']);
  assert.ok(distance(conflictStates[0], conflictStates[1]) >= 15, 'Conflict opponents are too close.');
  assert.ok(minPairDistance(conflictStates) >= 10, 'Conflict formation contains overlapping actors.');
  assert.equal(new Set(conflictStates.map((state) => state.bubbleLane)).size, 3);
  await page.screenshot({ path: 'social-choreography-conflict.png', fullPage: true });

  stage = 'council-table';
  await forceVisualScene('assigning');
  await waitFormation(['mira', 'kael', 'liora'], 'table');
  const table = await Promise.all(['mira', 'kael', 'liora'].map(heroState));
  diagnostics.table = table;
  assert.equal(new Set(table.map((state) => state.slot)).size, 3);
  assert.equal(new Set(table.map((state) => `${state.x.toFixed(1)},${state.y.toFixed(1)}`)).size, 3);
  assert.ok(minPairDistance(table) >= 13, 'Council participants overlap around the table.');
  assert.equal(table.find((state) => state.id === 'liora')?.gesture, 'present');
  assert.ok(table.filter((state) => state.id !== 'liora').every((state) => state.gesture === 'observe'));
  assert.equal(table.find((state) => state.id === 'liora')?.animation, 'Idle_Talking_Loop');
  await page.screenshot({ path: 'social-choreography-table.png', fullPage: true });

  stage = 'departure-line';
  await forceVisualScene('departure');
  await waitFormation(['mira', 'kael', 'liora'], 'line');
  const line = await Promise.all(['mira', 'kael', 'liora'].map(heroState));
  diagnostics.line = line;
  assert.equal(new Set(line.map((state) => state.slot)).size, 3);
  assert.ok(line.every((state) => state.facing === 'up'));
  assert.ok(line.every((state) => state.posture === 'ready'));
  assert.ok(line.every((state) => state.gesture === 'present'));
  assert.ok(line.every((state) => state.animation === 'Sword_Idle'));
  assert.ok(minPairDistance(line) >= 11, 'Departure line contains overlapping actors.');
  await page.screenshot({ path: 'social-choreography-line.png', fullPage: true });

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `Failed responses: ${failedResponses.map((entry) => `${entry.status} ${entry.url}`).join(' | ')}`);
  writeFileSync('social-choreography-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Social Choreography v1 browser smoke test passed.');
} catch (error) {
  writeFileSync('social-choreography-diagnostics.json', JSON.stringify({
    ok: false,
    stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics,
    pageErrors,
    failedResponses,
  }, null, 2));
  console.error('Social Choreography v1 browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'social-choreography-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
