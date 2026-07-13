import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const diagnostics = {};
const pageErrors = [];
const failedResponses = [];
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

const stateOf = async (id) => {
  const label = page.getByTestId(`hero-3d-${id}`);
  return {
    id,
    symbol: await label.getAttribute('data-expression-symbol'),
    movementRate: Number(await label.getAttribute('data-movement-rate')),
    animationRate: Number(await label.getAttribute('data-animation-rate')),
    bodyLean: Number(await label.getAttribute('data-body-lean')),
    bodyTension: Number(await label.getAttribute('data-body-tension')),
    x: Number(await label.getAttribute('data-world-x')),
    y: Number(await label.getAttribute('data-world-y')),
    facing: await label.getAttribute('data-facing'),
    formation: await label.getAttribute('data-choreography-formation'),
    partnerId: await label.getAttribute('data-partner-id'),
  };
};

const pairDistance = (left, right) => Math.hypot(right.x - left.x, right.y - left.y);
const zeroMap = (record) => { for (const key of Object.keys(record)) record[key] = 0; };

const forceRelationship = async ({ name, values, reciprocal = {}, leadership, injury = 0 }) => {
  await page.evaluate(({ scenarioName, relationValues, reverseValues, leadershipSetup, targetInjury }) => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    world.visualScenes = { scenes: [], nextId: 1 };
    world.socialScenes = [];
    world.lifeScenes = {
      activeSceneId: `relationship-${scenarioName}`,
      nextId: 2,
      handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
      scenes: [{
        id: `relationship-${scenarioName}`, type: 'conversation', title: `Отношение: ${scenarioName}`,
        status: 'active', phase: 'exchange', createdAt: world.tick, updatedAt: world.tick,
        participantIds: ['mira', 'kael'], roles: { mira: 'initiator', kael: 'target' },
        dialogue: [{ id: `line-${scenarioName}`, phase: 'exchange', speakerId: 'mira', text: 'Поговорим без лишних слов.', tone: 'neutral' }],
        currentLineIndex: 0, initiatorId: 'mira', targetId: 'kael',
      }],
    };

    for (const hero of Object.values(world.heroes)) {
      hero.currentAction = undefined;
      hero.currentActivity = undefined;
      for (const keyName of Object.keys(hero.emotions)) hero.emotions[keyName] = 0;
      hero.needs.fatigue = 0;
      hero.needs.solitude = 0;
      hero.psyche.stress = 0;
      hero.psyche.burnout = 0;
      hero.psyche.security = 70;
      hero.psyche.confidence = 50;
      hero.body.tissues.muscleFatigue = 0;
      hero.condition.injury = 0;
    }
    world.heroes.kael.condition.injury = targetInjury;

    const blank = { liking: 0, trust: 0, respect: 0, closeness: 0, fear: 0, resentment: 0, envy: 0, attraction: 0, debt: 0, rivalry: 0 };
    world.heroes.mira.relationships.kael = { targetId: 'kael', values: { ...blank, ...relationValues } };
    world.heroes.kael.relationships.mira = { targetId: 'mira', values: { ...blank, trust: 48, respect: 30, ...reverseValues } };

    if (leadershipSetup) {
      world.leadership ??= { groups: [], people: {}, lastEvaluationDay: -1, nextGroupId: 1, history: [] };
      world.leadership.familyLeaderId = 'mira';
      world.leadership.people ??= {};
      world.leadership.people.kael ??= { heroId: 'kael', role: 'follower', feelings: {}, bonds: {} };
      world.leadership.people.kael.role = leadershipSetup.role;
      world.leadership.people.kael.bonds ??= {};
      world.leadership.people.kael.bonds.mira = {
        targetId: 'mira', authority: leadershipSetup.authority, obedience: leadershipSetup.obedience,
        politicalLoyalty: leadershipSetup.politicalLoyalty, confidence: leadershipSetup.confidence,
        grievance: leadershipSetup.grievance, groupBond: 65,
      };
    }

    window.localStorage.setItem(key, JSON.stringify(world));
  }, { scenarioName: name, relationValues: values, reverseValues: reciprocal, leadershipSetup: leadership, targetInjury: injury });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await Promise.all(['mira', 'kael', 'liora'].map(waitRigged));
  await page.waitForFunction(() => ['mira', 'kael'].every((id) => {
    const label = document.querySelector(`[data-testid="hero-3d-${id}"]`);
    return label?.getAttribute('data-choreography-formation') === 'pair'
      && label.getAttribute('data-partner-id') !== 'none'
      && Number(label.getAttribute('data-world-x')) > 0;
  }), { timeout: 35_000 });

  const states = await Promise.all(['mira', 'kael'].map(stateOf));
  return { states, distance: pairDistance(states[0], states[1]) };
};

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await Promise.all(['mira', 'kael', 'liora'].map(waitRigged));

  stage = 'bonded';
  const bonded = await forceRelationship({ name: 'bonded', values: { closeness: 95, liking: 90, trust: 72, attraction: 28 } });
  diagnostics.bonded = bonded;
  assert.equal(bonded.states[0].symbol, '∞');
  assert.ok(bonded.states[0].animationRate < 1);
  await page.screenshot({ path: 'relationship-performance-bonded.png', fullPage: true });

  stage = 'trusting';
  const trusting = await forceRelationship({ name: 'trusting', values: { trust: 96, respect: 28, closeness: 12 } });
  diagnostics.trusting = trusting;
  assert.equal(trusting.states[0].symbol, '○');

  stage = 'respectful';
  const respectful = await forceRelationship({ name: 'respectful', values: { respect: 98, trust: 18 } });
  diagnostics.respectful = respectful;
  assert.equal(respectful.states[0].symbol, '◇');

  stage = 'guarded';
  const guarded = await forceRelationship({ name: 'guarded', values: { trust: -75, resentment: 18, fear: 12 } });
  diagnostics.guarded = guarded;
  assert.equal(guarded.states[0].symbol, '|');
  assert.ok(guarded.distance > bonded.distance + 1.2, 'Guarded pair did not increase social distance.');

  stage = 'intimidated';
  const intimidated = await forceRelationship({ name: 'intimidated', values: { fear: 96, trust: -20 } });
  diagnostics.intimidated = intimidated;
  assert.equal(intimidated.states[0].symbol, '!');
  assert.ok(intimidated.distance > bonded.distance + 1.5, 'Intimidated pair did not retreat from the partner.');
  await page.screenshot({ path: 'relationship-performance-intimidated.png', fullPage: true });

  stage = 'resentful';
  const resentful = await forceRelationship({ name: 'resentful', values: { resentment: 98, trust: -25 } });
  diagnostics.resentful = resentful;
  assert.equal(resentful.states[0].symbol, '×');
  assert.ok(resentful.states[0].bodyTension > bonded.states[0].bodyTension);

  stage = 'rivalrous';
  const rivalrous = await forceRelationship({ name: 'rivalrous', values: { rivalry: 96, envy: 72, respect: 20 } });
  diagnostics.rivalrous = rivalrous;
  assert.equal(rivalrous.states[0].symbol, '⇄');
  assert.ok(rivalrous.states[0].movementRate > 1);
  await page.screenshot({ path: 'relationship-performance-rivalrous.png', fullPage: true });

  stage = 'leadership';
  const deferential = await forceRelationship({
    name: 'leadership', values: { trust: 8, respect: 12 }, reciprocal: { trust: 20 },
    leadership: { role: 'follower', authority: 96, obedience: 92, politicalLoyalty: 88, confidence: 78, grievance: 2 },
  });
  diagnostics.deferential = deferential;
  assert.equal(deferential.states[1].symbol, '↓');
  assert.ok(deferential.states[1].animationRate < 1);
  await page.screenshot({ path: 'relationship-performance-leadership.png', fullPage: true });

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `Failed responses: ${failedResponses.map((entry) => `${entry.status} ${entry.url}`).join(' | ')}`);
  writeFileSync('relationship-performance-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Relationship Performance v1 browser smoke test passed.');
} catch (error) {
  writeFileSync('relationship-performance-diagnostics.json', JSON.stringify({
    ok: false, stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics, pageErrors, failedResponses,
  }, null, 2));
  console.error('Relationship Performance v1 browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'relationship-performance-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
