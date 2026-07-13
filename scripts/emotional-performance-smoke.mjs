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

const waitPerformance = async (id, performance) => {
  await page.waitForFunction(
    ({ heroId, expected }) => document.querySelector(`[data-testid="hero-3d-${heroId}"]`)?.getAttribute('data-emotional-performance') === expected,
    { heroId: id, expected: performance },
    { timeout: 25_000 },
  );
};

const waitFormation = async (ids, formation) => {
  await page.waitForFunction(
    ({ heroIds, expected }) => heroIds.every((id) => {
      const label = document.querySelector(`[data-testid="hero-3d-${id}"]`);
      const probe = document.querySelector(`[data-testid="interaction-${id}"]`);
      return label?.getAttribute('data-choreography-formation') === expected
        && probe?.getAttribute('data-interaction-contact') === 'active';
    }),
    { heroIds: ids, expected: formation },
    { timeout: 30_000 },
  );
};

const stateOf = async (id) => {
  const label = page.getByTestId(`hero-3d-${id}`);
  return {
    id,
    performance: await label.getAttribute('data-emotional-performance'),
    intensity: Number(await label.getAttribute('data-emotional-intensity')),
    movementRate: Number(await label.getAttribute('data-movement-rate')),
    animationRate: Number(await label.getAttribute('data-animation-rate')),
    lean: Number(await label.getAttribute('data-body-lean')),
    tension: Number(await label.getAttribute('data-body-tension')),
    symbol: await label.getAttribute('data-expression-symbol'),
    x: Number(await label.getAttribute('data-world-x')),
    y: Number(await label.getAttribute('data-world-y')),
    animation: await label.getAttribute('data-animation'),
    facing: await label.getAttribute('data-facing'),
  };
};

const distance = (left, right) => Math.hypot(right.x - left.x, right.y - left.y);

const neutralizeHero = (hero) => {
  Object.keys(hero.emotions).forEach((key) => { hero.emotions[key] = 0; });
  Object.keys(hero.needs).forEach((key) => { hero.needs[key] = 0; });
  Object.keys(hero.psyche).forEach((key) => { hero.psyche[key] = 0; });
  hero.psyche.security = 100;
  hero.traits.empathy = 0;
  hero.traits.discipline = 0;
  hero.traits.approvalSeeking = 0;
  hero.body.tissues.muscleFatigue = 0;
  hero.condition.injury = 0;
  Object.values(hero.relationships).forEach((relationship) => {
    Object.keys(relationship.values).forEach((key) => { relationship.values[key] = 0; });
  });
  hero.currentAction = undefined;
  hero.currentActivity = undefined;
};

const applyPreset = (hero, preset) => {
  neutralizeHero(hero);
  if (preset === 'angry') {
    hero.emotions.anger = 100;
    hero.emotions.irritation = 88;
    hero.psyche.stress = 82;
  } else if (preset === 'fearful') {
    hero.emotions.fear = 100;
    hero.emotions.anxiety = 88;
    hero.psyche.security = 0;
    hero.psyche.stress = 62;
  } else if (preset === 'affectionate') {
    hero.emotions.affection = 100;
    hero.emotions.joy = 38;
  } else if (preset === 'focused') {
    hero.emotions.interest = 100;
    hero.emotions.inspiration = 72;
    hero.psyche.confidence = 82;
    hero.traits.discipline = 92;
  } else if (preset === 'exhausted') {
    hero.needs.fatigue = 100;
    hero.psyche.burnout = 94;
    hero.body.tissues.muscleFatigue = 96;
    hero.condition.injury = 28;
  }
};

const setWorld = async ({ presets, scene }) => {
  await page.evaluate(({ nextPresets, nextScene }) => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    const neutralize = (hero) => {
      Object.keys(hero.emotions).forEach((name) => { hero.emotions[name] = 0; });
      Object.keys(hero.needs).forEach((name) => { hero.needs[name] = 0; });
      Object.keys(hero.psyche).forEach((name) => { hero.psyche[name] = 0; });
      hero.psyche.security = 100;
      hero.traits.empathy = 0;
      hero.traits.discipline = 0;
      hero.traits.approvalSeeking = 0;
      hero.body.tissues.muscleFatigue = 0;
      hero.condition.injury = 0;
      Object.values(hero.relationships).forEach((relationship) => Object.keys(relationship.values).forEach((name) => { relationship.values[name] = 0; }));
      hero.currentAction = undefined;
      hero.currentActivity = undefined;
    };
    const preset = (hero, name) => {
      neutralize(hero);
      if (name === 'angry') { hero.emotions.anger = 100; hero.emotions.irritation = 88; hero.psyche.stress = 82; }
      if (name === 'fearful') { hero.emotions.fear = 100; hero.emotions.anxiety = 88; hero.psyche.security = 0; hero.psyche.stress = 62; }
      if (name === 'affectionate') { hero.emotions.affection = 100; hero.emotions.joy = 38; }
      if (name === 'focused') { hero.emotions.interest = 100; hero.emotions.inspiration = 72; hero.psyche.confidence = 82; hero.traits.discipline = 92; }
      if (name === 'exhausted') { hero.needs.fatigue = 100; hero.psyche.burnout = 94; hero.body.tissues.muscleFatigue = 96; hero.condition.injury = 28; }
    };
    Object.entries(nextPresets).forEach(([id, name]) => preset(world.heroes[id], name));

    // Emotional Performance is tested independently from political and relational modifiers.
    // Liora is outside the tested Mira/Kael pair, while all leadership bonds are neutralized.
    if (world.leadership) {
      world.leadership.familyLeaderId = 'liora';
      for (const person of Object.values(world.leadership.people ?? {})) {
        person.role = person.heroId === 'liora' ? 'leader' : 'independent';
        for (const bond of Object.values(person.bonds ?? {})) {
          bond.authority = 0;
          bond.obedience = 0;
          bond.politicalLoyalty = 0;
          bond.confidence = 0;
          bond.grievance = 0;
          bond.groupBond = 0;
        }
      }
    }

    world.visualScenes = { scenes: [], nextId: 1 };
    world.socialScenes = [];
    world.lifeScenes = nextScene ? {
      activeSceneId: nextScene.id,
      scenes: [nextScene],
      nextId: 2,
      handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    } : {
      scenes: [], nextId: 1, handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    window.localStorage.setItem(key, JSON.stringify(world));
  }, { nextPresets: presets, nextScene: scene });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await Promise.all(['mira', 'kael', 'liora'].map(waitRigged));
};

const conversation = (id, tone = 'neutral') => ({
  id, type: 'conversation', title: 'Эмоциональная дистанция', status: 'active', phase: 'exchange',
  createdAt: 10, updatedAt: 10, participantIds: ['mira', 'kael'],
  roles: { mira: 'initiator', kael: 'target' },
  dialogue: [{ id: `${id}-line`, phase: 'exchange', speakerId: 'mira', text: 'Я хочу поговорить.', tone }],
  currentLineIndex: 0, initiatorId: 'mira', targetId: 'kael',
});

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await Promise.all(['mira', 'kael', 'liora'].map(waitRigged));

  stage = 'independent-profiles';
  await setWorld({ presets: { mira: 'angry', kael: 'fearful', liora: 'exhausted' } });
  await Promise.all([waitPerformance('mira', 'angry'), waitPerformance('kael', 'fearful'), waitPerformance('liora', 'exhausted')]);
  const independent = await Promise.all(['mira', 'kael', 'liora'].map(stateOf));
  diagnostics.independent = independent;
  assert.ok(independent[0].intensity > 80 && independent[0].movementRate > 1.1 && independent[0].tension > 0.85);
  assert.ok(independent[1].intensity > 80 && independent[1].lean > 0 && independent[1].symbol === '!');
  assert.ok(independent[2].intensity > 80 && independent[2].movementRate < 0.7 && independent[2].animationRate < 0.7);
  await Promise.all(['mira', 'kael', 'liora'].map((id) => page.getByTestId(`emotion-expression-${id}`).waitFor()));
  await page.screenshot({ path: 'emotional-performance-profiles.png', fullPage: true });

  stage = 'neutral-distance';
  await setWorld({ presets: { mira: 'neutral', kael: 'neutral', liora: 'neutral' }, scene: conversation('emotion-neutral') });
  await waitFormation(['mira', 'kael'], 'pair');
  await Promise.all([waitPerformance('mira', 'neutral'), waitPerformance('kael', 'neutral')]);
  const neutralPair = await Promise.all(['mira', 'kael'].map(stateOf));
  const neutralDistance = distance(neutralPair[0], neutralPair[1]);
  diagnostics.neutralPair = { states: neutralPair, distance: neutralDistance };
  assert.ok(neutralDistance >= 11.5 && neutralDistance <= 12.5);

  stage = 'affectionate-distance';
  await setWorld({ presets: { mira: 'affectionate', kael: 'affectionate', liora: 'neutral' }, scene: conversation('emotion-affectionate', 'warm') });
  await waitFormation(['mira', 'kael'], 'pair');
  await Promise.all([waitPerformance('mira', 'affectionate'), waitPerformance('kael', 'affectionate')]);
  const affectionatePair = await Promise.all(['mira', 'kael'].map(stateOf));
  const affectionateDistance = distance(affectionatePair[0], affectionatePair[1]);
  diagnostics.affectionatePair = { states: affectionatePair, distance: affectionateDistance };
  assert.ok(affectionateDistance < neutralDistance - 0.6, 'Affection did not visibly reduce social distance.');
  assert.ok(affectionatePair.every((state) => state.lean < 0 && state.symbol === '♡'));
  await page.screenshot({ path: 'emotional-performance-affection.png', fullPage: true });

  stage = 'fearful-distance';
  await setWorld({ presets: { mira: 'fearful', kael: 'fearful', liora: 'neutral' }, scene: conversation('emotion-fearful') });
  await waitFormation(['mira', 'kael'], 'pair');
  await Promise.all([waitPerformance('mira', 'fearful'), waitPerformance('kael', 'fearful')]);
  const fearfulPair = await Promise.all(['mira', 'kael'].map(stateOf));
  const fearfulDistance = distance(fearfulPair[0], fearfulPair[1]);
  diagnostics.fearfulPair = { states: fearfulPair, distance: fearfulDistance };
  assert.ok(fearfulDistance > neutralDistance + 0.8, 'Fear did not visibly increase social distance.');
  assert.ok(fearfulPair.every((state) => state.movementRate > 1.1 && state.tension > 0.8));
  await page.screenshot({ path: 'emotional-performance-fear.png', fullPage: true });

  stage = 'conflict-performance';
  await setWorld({
    presets: { mira: 'angry', kael: 'fearful', liora: 'focused' },
    scene: {
      id: 'emotion-conflict', type: 'conflict', title: 'Эмоциональный конфликт', status: 'active', phase: 'exchange',
      createdAt: 30, updatedAt: 30, participantIds: ['mira', 'kael', 'liora'],
      roles: { mira: 'initiator', kael: 'target', liora: 'mediator' },
      dialogue: [{ id: 'emotion-conflict-line', phase: 'exchange', speakerId: 'mira', text: 'Хватит уходить от ответа.', tone: 'angry' }],
      currentLineIndex: 0, initiatorId: 'mira', targetId: 'kael', mediatorId: 'liora',
    },
  });
  await waitFormation(['mira', 'kael', 'liora'], 'conflict');
  await Promise.all([waitPerformance('mira', 'angry'), waitPerformance('kael', 'fearful'), waitPerformance('liora', 'focused')]);
  const conflict = await Promise.all(['mira', 'kael', 'liora'].map(stateOf));
  diagnostics.conflict = conflict;
  assert.equal(conflict[0].animation, 'Idle_Talking_Loop');
  assert.ok(conflict[0].animationRate > 1.1 && conflict[0].lean < 0);
  assert.ok(conflict[1].lean > 0 && conflict[1].tension > 0.8);
  assert.ok(conflict[2].tension > 0.5 && conflict[2].symbol === '◆');
  await page.screenshot({ path: 'emotional-performance-conflict.png', fullPage: true });

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `Failed responses: ${failedResponses.map((entry) => `${entry.status} ${entry.url}`).join(' | ')}`);
  writeFileSync('emotional-performance-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Emotional Performance v1 browser smoke test passed.');
} catch (error) {
  writeFileSync('emotional-performance-diagnostics.json', JSON.stringify({
    ok: false, stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics, pageErrors, failedResponses,
  }, null, 2));
  console.error('Emotional Performance v1 browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'emotional-performance-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
