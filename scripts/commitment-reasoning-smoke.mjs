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
page.on('response', (response) => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });

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

const injectScenario = async (mode) => {
  await page.evaluate(({ key, scenario }) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error('Base Tavernborne world is not stored');
    const world = JSON.parse(raw);
    const reset = (candidate) => {
      candidate.tick = 10;
      candidate.journal = [];
      candidate.socialScenes = [];
      candidate.expeditions = [{
        id: 'completed-day-zero', day: 0, floor: 1, partyIds: [], departTick: 0,
        plannedReturnTick: 1, status: 'completed', progress: 100, risk: 0, loot: [], events: [],
        outcome: 'Технически завершённая экспедиция для изоляции сценария',
      }];
      candidate.visualScenes = { scenes: [], nextId: 1 };
      candidate.lifeScenes = {
        scenes: [], nextId: 1, handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
        handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
      };
      delete candidate.commitmentReasoning;
      delete candidate.commitmentNegotiations;
      for (const hero of Object.values(candidate.heroes)) {
        hero.currentAction = undefined;
        hero.currentActivity = undefined;
        hero.dailyPlan = [];
        hero.planDay = 0;
        hero.lastReplanTick = 10;
        hero.lastSocialTick = -99;
        hero.condition.health = 100;
        hero.condition.injury = 0;
        hero.needs.hunger = 10;
        hero.needs.fatigue = 10;
      }
    };
    reset(world);

    const baseEntry = {
      sourceSceneId: `commitment-${scenario}-scene`, sourceLineId: `commitment-${scenario}-line`,
      speakerId: 'mira', audienceIds: ['kael'], targetId: 'kael', createdAt: 5,
      kind: 'promise', status: 'active', topic: 'проверка обязательства', strength: 72,
    };

    if (scenario === 'honor') {
      world.conversationConsequences = {
        entries: [{
          ...baseEntry, id: 'promise-honor', statement: 'Я обещаю закончить ремонт мастерской сегодня.',
          actionHint: 'work', dueTick: 12, planBlockId: 'promise-honor-plan',
        }],
        nextId: 2, processedSceneIds: [], processedJournalIds: [],
      };
      world.heroes.mira.dailyPlan = [
        { id: 'ordinary-reading', day: 0, startHour: 10, endHour: 12, actionId: 'read', label: 'Почитать', source: 'personal', status: 'planned' },
        { id: 'promise-honor-plan', day: 0, startHour: 10, endHour: 13, actionId: 'work', label: 'Закончить ремонт мастерской', source: 'personal', status: 'planned', targetId: 'kael' },
      ];
    } else if (scenario === 'reschedule') {
      world.conversationConsequences = {
        entries: [{
          ...baseEntry, id: 'promise-reschedule', statement: 'Я обещаю помочь тебе с припасами сегодня.',
          actionHint: 'help', dueTick: 14, planBlockId: 'promise-reschedule-plan',
        }],
        nextId: 2, processedSceneIds: [], processedJournalIds: [],
      };
      world.heroes.mira.dailyPlan = [
        { id: 'promise-reschedule-plan', day: 0, startHour: 12, endHour: 14, actionId: 'help', label: 'Помочь с припасами', source: 'personal', status: 'planned', targetId: 'kael' },
      ];
      world.expeditions = [{
        id: 'away-expedition', day: 0, floor: 1, partyIds: ['kael', 'liora'], departTick: 8,
        plannedReturnTick: 18, status: 'active', progress: 25, risk: 20, loot: [], events: [],
      }];
    } else {
      world.conversationConsequences = {
        entries: [{
          ...baseEntry, id: 'promise-break', statement: 'Я обещаю закончить ремонт до полудня.',
          actionHint: 'work', dueTick: 11, planBlockId: 'promise-break-plan', strength: 44,
        }],
        nextId: 2, processedSceneIds: [], processedJournalIds: [],
      };
      world.heroes.mira.dailyPlan = [
        { id: 'promise-break-plan', day: 0, startHour: 10, endHour: 12, actionId: 'work', label: 'Закончить ремонт', source: 'personal', status: 'planned', targetId: 'kael' },
      ];
      world.heroes.mira.condition.health = 8;
      world.heroes.mira.condition.injury = 94;
    }
    window.localStorage.setItem(key, JSON.stringify(world));
  }, { key: storageKey, scenario: mode });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();
};

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();

  stage = 'honor';
  await injectScenario('honor');
  await advanceHour();
  const honored = await storedWorld();
  const honorAssessment = honored.commitmentReasoning?.assessments?.find((item) => item.promiseId === 'promise-honor');
  assert.equal(honorAssessment?.decision, 'honor');
  assert.equal(honored.heroes.mira.dailyPlan.find((block) => block.id === 'ordinary-reading')?.status, 'skipped');
  assert.equal(honored.heroes.mira.currentActivity?.actionId, 'work');
  assert.equal(honored.heroes.mira.currentActivity?.planBlockId, 'promise-honor-plan');
  assert.ok(honored.journal.some((entry) => entry.text.includes('ставит обещание')));
  diagnostics.honor = { assessment: honorAssessment, activity: honored.heroes.mira.currentActivity };
  await page.screenshot({ path: 'commitment-reasoning-honor.png', fullPage: true });

  stage = 'reschedule';
  await injectScenario('reschedule');
  await advanceHour();
  const rescheduled = await storedWorld();
  const rescheduleEntry = rescheduled.conversationConsequences.entries.find((entry) => entry.id === 'promise-reschedule');
  const rescheduleAssessment = rescheduled.commitmentReasoning?.assessments?.find((item) => item.promiseId === 'promise-reschedule');
  const negotiation = rescheduled.commitmentNegotiations?.entries?.find((item) => item.promiseId === 'promise-reschedule');
  assert.equal(rescheduleAssessment?.decision, 'reschedule-request');
  assert.equal(rescheduleEntry.status, 'contested');
  assert.equal(rescheduleEntry.dueTick, 14, 'Срок не должен меняться до ответа адресата');
  assert.equal(rescheduleEntry.negotiationStatus, 'pending');
  assert.equal(rescheduleEntry.rescheduleCount, 1);
  assert.equal(negotiation?.status, 'pending');
  assert.ok(negotiation?.requestedDueTick >= 18);
  assert.ok(rescheduled.heroes.mira.dailyPlan.some((block) => block.label === 'Попросить перенести срок обещания'));
  assert.ok(rescheduled.journal.some((entry) => entry.text.includes('попросил') && entry.text.includes('перенести срок')));
  diagnostics.reschedule = { assessment: rescheduleAssessment, entry: rescheduleEntry, negotiation };
  await page.screenshot({ path: 'commitment-reasoning-reschedule.png', fullPage: true });

  stage = 'deliberate-break';
  await injectScenario('break');
  await advanceHour();
  const broken = await storedWorld();
  const brokenEntry = broken.conversationConsequences.entries.find((entry) => entry.id === 'promise-break');
  const breakAssessment = broken.commitmentReasoning?.assessments?.find((item) => item.promiseId === 'promise-break');
  assert.equal(breakAssessment?.decision, 'deliberate-break');
  assert.equal(brokenEntry.status, 'broken');
  assert.equal(broken.heroes.mira.currentActivity?.actionId, 'recover');
  assert.ok(broken.journal.some((entry) => entry.text.includes('сознательно нарушает обещание')));
  assert.ok(broken.journal.some((entry) => entry.text.includes('Обещание нарушено')));
  diagnostics.deliberateBreak = { assessment: breakAssessment, entry: brokenEntry };
  await page.screenshot({ path: 'commitment-reasoning-break.png', fullPage: true });

  stage = 'persistence';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitStoredWorld();
  const persisted = await storedWorld();
  assert.ok(persisted.commitmentReasoning?.assessments?.some((item) => item.decision === 'deliberate-break'));

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `Failed responses: ${failedResponses.map((entry) => `${entry.status} ${entry.url}`).join(' | ')}`);
  writeFileSync('commitment-reasoning-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Commitment Reasoning v1 browser smoke test passed.');
} catch (error) {
  writeFileSync('commitment-reasoning-diagnostics.json', JSON.stringify({
    ok: false, stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics, pageErrors, failedResponses,
  }, null, 2));
  console.error('Commitment Reasoning v1 browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'commitment-reasoning-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
