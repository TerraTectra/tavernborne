import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const storageKey = 'tavernborne.world.v2';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const pageErrors = [];
const failedResponses = [];
let stage = 'startup';

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()); });
page.on('response', (response) => {
  if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
});

const storedWorld = () => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), storageKey);

const waitCamp = async () => {
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor({ timeout: 25_000 });
  await page.waitForFunction((key) => Boolean(window.localStorage.getItem(key)), storageKey, { timeout: 20_000 });
};

const advanceHour = async () => {
  const before = (await storedWorld()).tick;
  await page.getByRole('button', { name: '+1 час', exact: true }).click({ noWaitAfter: true });
  await page.waitForFunction(
    ({ key, tick }) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw).tick > tick : false;
    },
    { key: storageKey, tick: before },
    { timeout: 20_000 },
  );
  await page.waitForTimeout(300);
};

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();

  stage = 'inject-restored-negotiation';
  await page.evaluate((key) => {
    const world = JSON.parse(window.localStorage.getItem(key));
    world.tick = 20;
    world.journal = [];
    world.expeditions = [{
      id: 'completed-loop-isolation', day: 0, floor: 1, partyIds: [], departTick: 0,
      plannedReturnTick: 1, status: 'completed', progress: 100, risk: 0, loot: [], events: [],
      outcome: 'Технически завершённая экспедиция',
    }];
    world.routine = { wakeHour: 6, breakfastHour: 6, lunchHour: 16, dinnerHour: 19, sleepHour: 23 };
    world.visualScenes = { scenes: [], nextId: 1 };
    world.lifeScenes = {
      scenes: [], nextId: 1, handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    delete world.commitmentReasoning;

    for (const hero of Object.values(world.heroes)) {
      hero.currentAction = undefined;
      hero.currentActivity = undefined;
      hero.dailyPlan = [{
        id: `${hero.id}-loop-placeholder`, day: 0, startHour: 0, endHour: 1,
        actionId: 'read', label: 'Завершённый технический блок', source: 'personal', status: 'done',
      }];
      hero.planDay = 0;
      hero.lastReplanTick = 20;
      hero.lastSocialTick = -99;
      hero.condition.health = 100;
      hero.condition.injury = 0;
      hero.needs.hunger = 10;
      hero.needs.fatigue = 10;
    }

    world.conversationConsequences = {
      entries: [{
        id: 'promise-loop', sourceSceneId: 'promise-loop-source', sourceLineId: 'promise-loop-line',
        speakerId: 'mira', audienceIds: ['kael'], targetId: 'kael', createdAt: 5,
        kind: 'promise', status: 'contested', statement: 'Я закончу работу позже.',
        topic: 'защита от фантомного обещания', strength: 70, actionHint: 'work', dueTick: 50,
        negotiationStatus: 'accepted', negotiationId: 'commitment-negotiation-loop',
        requestedDueTick: 50, lastNegotiationTick: 20, lastNegotiatedDueTick: 50,
        negotiationReevaluateAt: 100,
      }],
      nextId: 2, processedSceneIds: [], processedJournalIds: [],
    };

    const dangerousRequest = 'Каэль, я не успеваю выполнить обещание в прежний срок: мне нужно восстановиться. Прошу перенести его до 3-й день, 02:00.';
    world.commitmentNegotiations = {
      entries: [{
        id: 'commitment-negotiation-loop', promiseId: 'promise-loop', requesterId: 'mira', responderId: 'kael',
        createdAt: 19, resolveAt: 20, originalDueTick: 24, requestedDueTick: 50,
        reason: 'нужно восстановиться', status: 'resolved', outcome: 'accepted', responseScore: 90,
        finalDueTick: 50, requesterLine: dangerousRequest,
        responderLine: 'Хорошо. Я согласен перенести срок до 3-й день, 02:00.',
        socialSceneId: 'commitment-negotiation-scene-loop',
      }],
      nextId: 2, processedRequestKeys: ['19:promise-loop:1'],
    };

    world.socialScenes = [{
      id: 'commitment-negotiation-scene-loop', actionId: 'talk', initiatorId: 'mira', targetId: 'kael',
      createdAt: 20, status: 'resolved', response: 'accepted', remainingHours: 0, planBlockIds: [],
      lines: [
        { id: 'loop-request', tick: 20, speakerId: 'mira', text: dangerousRequest, tone: 'apologetic' },
        { id: 'loop-response', tick: 20, speakerId: 'kael', text: 'Хорошо. Я согласен перенести срок до 3-й день, 02:00.', tone: 'warm' },
      ],
      reason: 'обсудить срок обещания',
      outcome: 'Адресат согласился перенести срок обещания.',
    }];

    window.localStorage.setItem(key, JSON.stringify(world));
  }, storageKey);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();

  stage = 'scene-created';
  await advanceHour();
  const created = await storedWorld();
  const sourceScene = created.socialScenes.find((scene) => scene.id === 'commitment-negotiation-scene-loop');
  const lifeScene = created.lifeScenes?.scenes?.find((scene) => scene.sourceSocialSceneId === sourceScene.id);
  assert.ok(lifeScene, 'Restored negotiation did not become a life scene');
  assert.ok(sourceScene.lines.every((line) => !line.text.toLocaleLowerCase('ru-RU').includes('обещ')));
  assert.ok(!sourceScene.outcome.toLocaleLowerCase('ru-RU').includes('обещ'));
  assert.ok(lifeScene.dialogue.every((line) => !line.text.toLocaleLowerCase('ru-RU').includes('обещ')));
  assert.ok(lifeScene.dialogue.some((line) => line.text.includes('закончить дело')));

  stage = 'scene-resolved';
  for (let index = 0; index < 5; index += 1) await advanceHour();
  const resolved = await storedWorld();
  const resolvedLifeScene = resolved.lifeScenes.scenes.find((scene) => scene.id === lifeScene.id);
  const promises = resolved.conversationConsequences.entries.filter((entry) => entry.kind === 'promise');
  assert.equal(resolvedLifeScene.status, 'resolved');
  assert.equal(promises.length, 1, 'Negotiation dialogue created a phantom promise');
  assert.equal(promises[0].id, 'promise-loop');
  assert.ok(resolved.conversationConsequences.processedSceneIds.includes(lifeScene.id));
  assert.ok(!resolved.journal.some((entry) => entry.text.includes('Обещание зафиксировано')));

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `Failed responses: ${failedResponses.map((entry) => `${entry.status} ${entry.url}`).join(' | ')}`);
  writeFileSync('commitment-negotiation-loop-diagnostics.json', JSON.stringify({
    ok: true,
    sourceScene,
    lifeScene: resolvedLifeScene,
    consequences: resolved.conversationConsequences.entries,
    pageErrors,
    failedResponses,
  }, null, 2));
  await page.screenshot({ path: 'commitment-negotiation-loop.png', fullPage: true });
  console.log('Commitment Negotiation dialogue loop smoke test passed.');
} catch (error) {
  writeFileSync('commitment-negotiation-loop-diagnostics.json', JSON.stringify({
    ok: false,
    stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    pageErrors,
    failedResponses,
  }, null, 2));
  console.error('Commitment Negotiation dialogue loop smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'commitment-negotiation-loop-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
