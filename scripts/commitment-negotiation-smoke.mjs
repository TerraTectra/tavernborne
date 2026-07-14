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
  await page.waitForTimeout(350);
};

const setRelationship = (hero, targetId, values) => {
  hero.relationships[targetId] ??= {
    targetId,
    values: {
      liking: 0, trust: 0, respect: 0, closeness: 0, fear: 0,
      resentment: 0, envy: 0, attraction: 0, debt: 0, rivalry: 0,
    },
  };
  Object.assign(hero.relationships[targetId].values, values);
};

const injectScenario = async (mode) => {
  await page.evaluate(({ key, scenario }) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error('Base Tavernborne world is not stored');
    const world = JSON.parse(raw);
    const relationship = (hero, targetId, values) => {
      hero.relationships[targetId] ??= {
        targetId,
        values: {
          liking: 0, trust: 0, respect: 0, closeness: 0, fear: 0,
          resentment: 0, envy: 0, attraction: 0, debt: 0, rivalry: 0,
        },
      };
      Object.assign(hero.relationships[targetId].values, values);
    };

    world.tick = 10;
    world.journal = [];
    world.socialScenes = [];
    world.expeditions = [{
      id: 'completed-day-zero', day: 0, floor: 1, partyIds: [], departTick: 0,
      plannedReturnTick: 1, status: 'completed', progress: 100, risk: 0, loot: [], events: [],
      outcome: 'Технически завершённая экспедиция для изоляции переговоров',
    }];
    world.routine = { wakeHour: 6, breakfastHour: 6, lunchHour: 16, dinnerHour: 21, sleepHour: 23 };
    world.visualScenes = { scenes: [], nextId: 1 };
    world.lifeScenes = {
      scenes: [], nextId: 1, handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    delete world.commitmentReasoning;
    delete world.commitmentNegotiations;

    for (const hero of Object.values(world.heroes)) {
      hero.currentAction = undefined;
      hero.currentActivity = undefined;
      hero.dailyPlan = [{
        id: `${hero.id}-placeholder`, day: 0, startHour: 0, endHour: 1,
        actionId: 'read', label: 'Завершённый технический блок', source: 'personal', status: 'done',
      }];
      hero.planDay = 0;
      hero.lastReplanTick = 10;
      hero.lastSocialTick = -99;
      hero.condition.health = 100;
      hero.condition.injury = 0;
      hero.needs.hunger = 10;
      hero.needs.fatigue = 15;
      hero.emotions.anger = 0;
      hero.emotions.irritation = 0;
      hero.psyche.stress = 10;
    }

    const requester = world.heroes.mira;
    const responder = world.heroes.kael;
    if (!requester || !responder) throw new Error('Smoke scenario requires mira and kael');

    requester.condition.health = 35;
    requester.condition.injury = 60;
    requester.traits.honesty = 50;
    requester.traits.discipline = 50;
    requester.dailyPlan = [{
      id: `promise-${scenario}-plan`, day: 0, startHour: 10, endHour: 12,
      actionId: 'work', label: 'Закончить обещанную работу', source: 'personal', status: 'planned', targetId: 'kael',
    }];

    if (scenario === 'accepted') {
      responder.traits.empathy = 95;
      responder.traits.patience = 95;
      responder.traits.kindness = 95;
      responder.traits.loyalty = 95;
      responder.psyche.stress = 0;
      relationship(responder, requester.id, {
        trust: 72, respect: 66, closeness: 62, liking: 68, resentment: 0,
      });
    } else if (scenario === 'countered') {
      responder.traits.empathy = 50;
      responder.traits.patience = 50;
      responder.traits.kindness = 50;
      responder.traits.loyalty = 50;
      responder.psyche.stress = 40;
      relationship(responder, requester.id, {
        trust: 0, respect: 0, closeness: 0, liking: 0, resentment: 0,
      });
    } else {
      responder.traits.empathy = 5;
      responder.traits.patience = 5;
      responder.traits.kindness = 5;
      responder.traits.loyalty = 5;
      responder.psyche.stress = 90;
      responder.emotions.anger = 80;
      responder.emotions.irritation = 70;
      relationship(responder, requester.id, {
        trust: -40, respect: -30, closeness: -20, liking: -30, resentment: 80,
      });
    }

    world.conversationConsequences = {
      entries: [{
        id: `promise-${scenario}`,
        sourceSceneId: `promise-${scenario}-source`,
        sourceLineId: `promise-${scenario}-line`,
        speakerId: 'mira', audienceIds: ['kael'], targetId: 'kael', createdAt: 5,
        kind: 'promise', status: 'active', statement: 'Я закончу работу к полудню.',
        topic: 'проверка переговоров', strength: scenario === 'refused' ? 90 : 72,
        actionHint: 'work', dueTick: 12, planBlockId: `promise-${scenario}-plan`,
      }],
      nextId: 2, processedSceneIds: [], processedJournalIds: [],
    };

    window.localStorage.setItem(key, JSON.stringify(world));
  }, { key: storageKey, scenario: mode });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();
};

const runScenario = async (mode, expectedOutcome) => {
  await injectScenario(mode);

  await advanceHour();
  const pendingWorld = await storedWorld();
  const pendingPromise = pendingWorld.conversationConsequences.entries.find((entry) => entry.id === `promise-${mode}`);
  const pendingNegotiation = pendingWorld.commitmentNegotiations?.entries?.find((entry) => entry.promiseId === `promise-${mode}`);
  assert.equal(pendingNegotiation?.status, 'pending');
  assert.equal(pendingPromise.status, 'contested');
  assert.equal(pendingPromise.dueTick, 12, 'Deadline must remain unchanged while the answer is pending');
  assert.equal(pendingPromise.negotiationStatus, 'pending');
  assert.ok(pendingNegotiation.requestedDueTick > pendingNegotiation.originalDueTick);
  assert.equal(pendingWorld.heroes.mira.dailyPlan.find((block) => block.id === `promise-${mode}-plan`)?.status, 'skipped');
  assert.ok(pendingWorld.journal.some((entry) => entry.text.includes('Ответ ещё не получен')));

  const trustBefore = pendingWorld.heroes.kael.relationships.mira?.values.trust ?? 0;
  await advanceHour();
  const resolvedWorld = await storedWorld();
  const promise = resolvedWorld.conversationConsequences.entries.find((entry) => entry.id === `promise-${mode}`);
  const negotiation = resolvedWorld.commitmentNegotiations.entries.find((entry) => entry.promiseId === `promise-${mode}`);
  assert.equal(negotiation.status, 'resolved');
  assert.equal(negotiation.outcome, expectedOutcome);
  assert.equal(promise.negotiationStatus, expectedOutcome);
  assert.equal(promise.status, 'contested', 'Resolved negotiations receive a short reasoning cooldown');
  assert.equal(promise.rescheduleCount, 1);
  assert.equal(resolvedWorld.commitmentNegotiations.entries.filter((entry) => entry.promiseId === `promise-${mode}`).length, 1);
  assert.ok(Number.isFinite(negotiation.responseScore));
  assert.ok(resolvedWorld.socialScenes.some((scene) => scene.id === negotiation.socialSceneId && scene.lines.length === 2));
  assert.equal(
    resolvedWorld.heroes.mira.dailyPlan.find((block) => block.id === `promise-${mode}-reschedule-request-1`)?.status,
    'done',
  );

  if (expectedOutcome === 'accepted') {
    assert.equal(negotiation.finalDueTick, negotiation.requestedDueTick);
    assert.equal(promise.dueTick, negotiation.requestedDueTick);
    assert.ok((resolvedWorld.heroes.kael.relationships.mira?.values.trust ?? 0) > trustBefore);
    assert.ok(resolvedWorld.journal.some((entry) => entry.text.includes('согласился перенести срок')));
  } else if (expectedOutcome === 'countered') {
    assert.ok(negotiation.finalDueTick > negotiation.originalDueTick);
    assert.ok(negotiation.finalDueTick < negotiation.requestedDueTick);
    assert.equal(promise.dueTick, negotiation.finalDueTick);
    assert.ok(resolvedWorld.journal.some((entry) => entry.text.includes('встречный срок')));
  } else {
    assert.equal(negotiation.finalDueTick, negotiation.originalDueTick);
    assert.equal(promise.dueTick, 12);
    assert.ok(resolvedWorld.journal.some((entry) => entry.text.includes('отказался переносить срок')));
  }

  await advanceHour();
  const visualWorld = await storedWorld();
  const lifeScene = visualWorld.lifeScenes?.scenes?.find((scene) => scene.sourceSocialSceneId === negotiation.socialSceneId);
  assert.ok(lifeScene, 'Negotiation result must become a visible life scene');
  assert.equal(lifeScene.type, 'conversation');
  assert.ok(lifeScene.dialogue.some((line) => line.text.includes('перенести')));
  assert.equal(visualWorld.commitmentNegotiations.entries.filter((entry) => entry.promiseId === `promise-${mode}`).length, 1);

  if (expectedOutcome === 'refused') {
    const refusedPromise = visualWorld.conversationConsequences.entries.find((entry) => entry.id === `promise-${mode}`);
    assert.equal(refusedPromise.status, 'broken');
    assert.ok(visualWorld.journal.some((entry) => entry.text.includes('Обещание нарушено')));
  }

  diagnostics[mode] = {
    pending: pendingNegotiation,
    resolved: negotiation,
    promise: visualWorld.conversationConsequences.entries.find((entry) => entry.id === `promise-${mode}`),
    lifeScene: { id: lifeScene.id, phase: lifeScene.phase, status: lifeScene.status },
  };
  await page.screenshot({ path: `commitment-negotiation-${mode}.png`, fullPage: true });
};

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();

  stage = 'accepted';
  await runScenario('accepted', 'accepted');
  stage = 'countered';
  await runScenario('countered', 'countered');
  stage = 'refused';
  await runScenario('refused', 'refused');

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `Failed responses: ${failedResponses.map((entry) => `${entry.status} ${entry.url}`).join(' | ')}`);
  writeFileSync('commitment-negotiation-diagnostics.json', JSON.stringify({
    ok: true, stage, diagnostics, pageErrors, failedResponses,
  }, null, 2));
  console.log('Commitment Negotiation v1 browser smoke test passed.');
} catch (error) {
  writeFileSync('commitment-negotiation-diagnostics.json', JSON.stringify({
    ok: false, stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics, pageErrors, failedResponses,
  }, null, 2));
  console.error('Commitment Negotiation v1 browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'commitment-negotiation-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
