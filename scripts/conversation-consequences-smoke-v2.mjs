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
page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });

const waitRigged = async (id) => {
  await page.getByTestId(`hero-3d-${id}`).waitFor({ timeout: 25_000 });
  await page.waitForFunction(
    (heroId) => document.querySelector(`[data-testid="hero-3d-${heroId}"]`)?.getAttribute('data-visual-mode') === 'rigged-asset',
    id,
    { timeout: 25_000 },
  );
};

const advanceHour = async (wait = 950) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click({ noWaitAfter: true });
  await page.waitForTimeout(wait);
};

const storedWorld = () => page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2')));

const prepareActivePromise = async ({ id, text }) => {
  await page.evaluate((config) => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    world.tick = 10;
    world.journal = [];
    world.socialScenes = [];
    world.expeditions = [];
    world.visualScenes = { scenes: [], nextId: 1 };
    delete world.conversationConsequences;
    for (const hero of Object.values(world.heroes)) {
      hero.currentAction = undefined;
      hero.currentActivity = undefined;
      hero.dailyPlan = [];
      hero.planDay = 0;
      hero.lastReplanTick = 10;
      hero.lastSocialTick = -99;
      hero.memories = [];
      Object.keys(hero.emotions).forEach((name) => { hero.emotions[name] = 0; });
      Object.keys(hero.psyche).forEach((name) => { hero.psyche[name] = name === 'security' ? 100 : 0; });
    }
    world.heroes.kael.relationships.mira.values.trust = 10;
    world.heroes.kael.relationships.mira.values.resentment = 0;
    world.lifeScenes = {
      activeSceneId: config.id,
      scenes: [{
        id: config.id,
        type: 'conversation',
        title: 'Проверка последствий разговора',
        status: 'active',
        phase: 'resolution',
        createdAt: 5,
        updatedAt: 10,
        participantIds: ['mira', 'kael'],
        roles: { mira: 'initiator', kael: 'target' },
        dialogue: [{ id: `${config.id}-line-0`, phase: 'resolution', speakerId: 'mira', text: config.text, tone: 'warm' }],
        currentLineIndex: 0,
        initiatorId: 'mira',
        targetId: 'kael',
        effectsApplied: true,
      }],
      nextId: 2,
      handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    window.localStorage.setItem(key, JSON.stringify(world));
  }, { id, text });
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

  stage = 'promise-recorded';
  const helpPromiseText = 'Я обещаю помочь тебе закончить мастерскую сегодня.';
  await prepareActivePromise({ id: 'consequence-help-promise', text: helpPromiseText });
  await advanceHour();
  const promised = await storedWorld();
  diagnostics.recordedWorld = {
    tick: promised.tick,
    consequences: promised.conversationConsequences,
    lifeScenes: promised.lifeScenes,
    plans: promised.heroes.mira.dailyPlan,
    journal: promised.journal.slice(0, 12),
  };
  const promise = promised.conversationConsequences?.entries?.find((entry) => entry.kind === 'promise');
  assert.ok(promise, 'Обещание не было извлечено при реальном завершении сцены');
  assert.equal(promise.status, 'active');
  assert.equal(promise.actionHint, 'help');
  assert.equal(promise.targetId, 'kael');
  assert.equal(promise.statement, helpPromiseText);
  const promisePlan = promised.heroes.mira.dailyPlan.find((block) => block.id === promise.planBlockId);
  assert.ok(promisePlan, 'Обещание не создало блок будущего решения');
  assert.equal(promisePlan.actionId, 'help');
  assert.equal(promisePlan.targetId, 'kael');
  assert.ok(promised.heroes.kael.memories.some((memory) => memory.summary.includes(helpPromiseText)));
  assert.ok(promised.journal.some((entry) => entry.text.includes('Обещание зафиксировано')));
  diagnostics.promise = { entry: promise, plan: promisePlan };
  await page.screenshot({ path: 'conversation-consequences-promise.png', fullPage: true });

  stage = 'promise-fulfilled';
  const trustBeforeFulfillment = promised.heroes.kael.relationships.mira.values.trust;
  await page.evaluate(() => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    world.journal.unshift({
      id: 'evidence-help-fulfilled',
      tick: world.tick + 1,
      text: 'Мира помогла Каэлю закончить мастерскую.',
      heroIds: ['mira', 'kael'],
      kind: 'social',
    });
    for (const hero of Object.values(world.heroes)) hero.lastReplanTick = world.tick;
    window.localStorage.setItem(key, JSON.stringify(world));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await advanceHour();
  const fulfilledWorld = await storedWorld();
  const fulfilled = fulfilledWorld.conversationConsequences.entries.find((entry) => entry.id === promise.id);
  assert.equal(fulfilled.status, 'fulfilled');
  assert.ok(fulfilled.resolution.includes('помогла Каэлю'));
  assert.ok(fulfilledWorld.heroes.kael.relationships.mira.values.trust >= trustBeforeFulfillment + 3.5);
  assert.equal(fulfilledWorld.heroes.mira.dailyPlan.find((block) => block.id === promise.planBlockId)?.status, 'done');
  assert.ok(fulfilledWorld.heroes.kael.memories.some((memory) => memory.tags.includes('fulfilled')));
  diagnostics.fulfilled = fulfilled;
  await page.screenshot({ path: 'conversation-consequences-fulfilled.png', fullPage: true });

  stage = 'promise-broken-setup';
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  const talkPromiseText = 'Я обещаю вернуться к разговору вечером.';
  await prepareActivePromise({ id: 'consequence-talk-promise', text: talkPromiseText });
  await advanceHour();
  const activeBrokenCandidate = await storedWorld();
  const talkPromise = activeBrokenCandidate.conversationConsequences.entries.find((entry) => entry.kind === 'promise');
  assert.equal(talkPromise.actionHint, 'talk');
  const trustBeforeBreak = activeBrokenCandidate.heroes.kael.relationships.mira.values.trust;
  const resentmentBeforeBreak = activeBrokenCandidate.heroes.kael.relationships.mira.values.resentment;

  stage = 'promise-broken';
  await page.evaluate((entryId) => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    const entry = world.conversationConsequences.entries.find((candidate) => candidate.id === entryId);
    entry.dueTick = world.tick - 1;
    for (const hero of Object.values(world.heroes)) hero.lastReplanTick = world.tick;
    window.localStorage.setItem(key, JSON.stringify(world));
  }, talkPromise.id);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await advanceHour();
  const brokenWorld = await storedWorld();
  const broken = brokenWorld.conversationConsequences.entries.find((entry) => entry.id === talkPromise.id);
  assert.equal(broken.status, 'broken');
  assert.ok(brokenWorld.heroes.kael.relationships.mira.values.trust <= trustBeforeBreak - 5.5);
  assert.ok(brokenWorld.heroes.kael.relationships.mira.values.resentment >= resentmentBeforeBreak + 4.5);
  assert.ok(brokenWorld.heroes.mira.emotions.guilt >= 8);
  const repairPlan = brokenWorld.heroes.mira.dailyPlan.find((block) => block.id === `${talkPromise.id}-repair-plan`);
  assert.ok(repairPlan, 'Нарушенное обещание не создало попытку объясниться');
  assert.equal(repairPlan.actionId, 'apologize');
  assert.equal(repairPlan.targetId, 'kael');
  assert.ok(brokenWorld.heroes.kael.memories.some((memory) => memory.tags.includes('broken')));
  diagnostics.broken = { entry: broken, repairPlan };
  await page.screenshot({ path: 'conversation-consequences-broken.png', fullPage: true });

  stage = 'future-conversation-memory';
  await page.evaluate(() => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    const kael = world.heroes.kael;
    Object.keys(kael.traits).forEach((name) => { kael.traits[name] = 0; });
    Object.keys(kael.emotions).forEach((name) => { kael.emotions[name] = 0; });
    kael.emotions.sadness = 100;
    kael.emotions.anger = 80;
    kael.psyche.security = 100;
    world.visualScenes = { scenes: [], nextId: 1 };
    world.lifeScenes = {
      activeSceneId: 'future-memory-scene',
      scenes: [{
        id: 'future-memory-scene', type: 'conversation', title: 'Возвращение к обещанию',
        status: 'active', phase: 'exchange', createdAt: world.tick, updatedAt: world.tick,
        participantIds: ['kael', 'mira'], roles: { kael: 'initiator', mira: 'target' },
        dialogue: [{ id: 'future-memory-line', phase: 'exchange', speakerId: 'kael', text: 'Ты снова просишь меня поверить тебе.', tone: 'hurt' }],
        currentLineIndex: 0, initiatorId: 'kael', targetId: 'mira',
      }],
      nextId: 2,
      handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    window.localStorage.setItem(key, JSON.stringify(world));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await Promise.all(['mira', 'kael', 'liora'].map(waitRigged));
  await page.waitForFunction(() => {
    const label = document.querySelector('[data-testid="hero-3d-kael"]');
    const bubble = document.querySelector('[data-testid="dialogue-bubble-kael"]');
    return label?.getAttribute('data-dialogue-performance') === 'wounded'
      && Boolean(bubble?.textContent?.includes('вернуться к разговору'));
  }, undefined, { timeout: 35_000 });
  const futureText = (await page.getByTestId('dialogue-bubble-kael').textContent())?.trim() ?? '';
  assert.ok(futureText.startsWith('После того, как'));
  diagnostics.futureConversation = { text: futureText };
  await page.screenshot({ path: 'conversation-consequences-future-memory.png', fullPage: true });

  stage = 'persistence';
  await page.reload({ waitUntil: 'domcontentloaded' });
  const persisted = await storedWorld();
  assert.equal(persisted.conversationConsequences.entries.find((entry) => entry.id === talkPromise.id)?.status, 'broken');

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `Failed responses: ${failedResponses.map((entry) => `${entry.status} ${entry.url}`).join(' | ')}`);
  writeFileSync('conversation-consequences-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Conversation Consequences v1 browser smoke test passed.');
} catch (error) {
  writeFileSync('conversation-consequences-diagnostics.json', JSON.stringify({
    ok: false, stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics, pageErrors, failedResponses,
  }, null, 2));
  console.error('Conversation Consequences v1 browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'conversation-consequences-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
