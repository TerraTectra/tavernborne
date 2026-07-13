import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1120 } });
const pageErrors = [];
const diagnostics = {};
let stage = 'startup';

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const waitRigged = async (id) => {
  await page.getByTestId(`hero-3d-${id}`).waitFor({ timeout: 20_000 });
  await page.waitForFunction(
    (heroId) => document.querySelector(`[data-testid="hero-3d-${heroId}"]`)?.getAttribute('data-visual-mode') === 'rigged-asset',
    id,
    { timeout: 20_000 },
  );
};

const waitInteraction = async (id, kind) => {
  await page.waitForFunction(
    ({ heroId, interactionKind }) => {
      const label = document.querySelector(`[data-testid="hero-3d-${heroId}"]`);
      const probe = document.querySelector(`[data-testid="interaction-${heroId}"]`);
      return label?.getAttribute('data-interaction-kind') === interactionKind
        && probe?.getAttribute('data-interaction-kind') === interactionKind
        && probe?.getAttribute('data-interaction-contact') === 'active';
    },
    { heroId: id, interactionKind: kind },
    { timeout: 20_000 },
  );
};

const heroState = async (id) => {
  const label = page.getByTestId(`hero-3d-${id}`);
  const probe = page.getByTestId(`interaction-${id}`);
  return {
    id,
    mode: await label.getAttribute('data-visual-mode'),
    intent: await label.getAttribute('data-animation-intent'),
    animation: await label.getAttribute('data-animation'),
    interaction: await label.getAttribute('data-interaction-kind'),
    posture: await label.getAttribute('data-interaction-posture'),
    gesture: await label.getAttribute('data-gesture'),
    sceneProp: await label.getAttribute('data-scene-prop'),
    equipment: await label.getAttribute('data-equipment-state'),
    probeKind: await probe.getAttribute('data-interaction-kind'),
    probeContact: await probe.getAttribute('data-interaction-contact'),
    probeProp: await probe.getAttribute('data-interaction-prop'),
  };
};

const forceActions = async (actions) => {
  await page.evaluate((nextActions) => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    world.visualScenes = { scenes: [], nextId: 1 };
    world.lifeScenes = {
      scenes: [], nextId: 1, handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    for (const [heroId, value] of Object.entries(nextActions)) {
      const hero = world.heroes[heroId];
      hero.currentAction = { actionId: value.actionId, targetId: value.targetId, label: value.actionId, score: 100, reasons: [] };
      hero.currentActivity = {
        actionId: value.actionId,
        label: value.actionId,
        startedAt: world.tick,
        durationHours: 4,
        remainingHours: 4,
        source: 'personal',
        targetId: value.targetId,
      };
    }
    window.localStorage.setItem(key, JSON.stringify(world));
  }, actions);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await Promise.all(['mira', 'kael', 'liora'].map(waitRigged));
};

const forceCouncilPhase = async (phase) => {
  await page.evaluate((nextPhase) => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    const line = {
      id: `interaction-test-${nextPhase}`,
      phase: nextPhase,
      speakerId: 'mira',
      text: nextPhase === 'equipping' ? 'Проверяем снаряжение.' : 'К выходу. Оружие приготовить.',
      tone: 'firm',
    };
    world.visualScenes = {
      activeSceneId: 'interaction-polish-council',
      nextId: 2,
      scenes: [{
        id: 'interaction-polish-council',
        type: 'expeditionCouncil',
        title: 'Проверка взаимодействий',
        status: 'active',
        phase: nextPhase,
        createdAt: world.tick,
        updatedAt: world.tick,
        expeditionId: 'interaction-polish-expedition',
        leaderId: 'mira',
        participantIds: ['mira', 'kael', 'liora'],
        partyIds: ['mira', 'kael'],
        roles: { mira: 'leader', kael: 'vanguard' },
        responses: { mira: 'accepted', kael: 'accepted', liora: 'accepted' },
        dialogue: [line],
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

  stage = 'domestic-actions';
  await forceActions({
    mira: { actionId: 'read' },
    kael: { actionId: 'work' },
    liora: { actionId: 'sleep' },
  });
  await Promise.all([
    waitInteraction('mira', 'reading'),
    waitInteraction('kael', 'work'),
    waitInteraction('liora', 'sleep'),
  ]);
  const domestic = await Promise.all(['mira', 'kael', 'liora'].map(heroState));
  diagnostics.domestic = domestic;
  assert.equal(domestic[0].intent, 'read');
  assert.equal(domestic[0].animation, 'Sitting_Idle_Loop');
  assert.equal(domestic[0].posture, 'seated');
  assert.equal(domestic[1].intent, 'work');
  assert.equal(domestic[1].animation, 'Fixing_Kneeling');
  assert.equal(domestic[1].posture, 'leaning');
  assert.equal(domestic[2].intent, 'sleep');
  assert.equal(domestic[2].animation, 'Sitting_Idle_Loop');
  assert.equal(domestic[2].posture, 'resting');
  await page.screenshot({ path: 'interaction-polish-domestic.png', fullPage: true });

  stage = 'physical-actions';
  await forceActions({
    mira: { actionId: 'eat' },
    kael: { actionId: 'train' },
    liora: { actionId: 'recover' },
  });
  await Promise.all([
    waitInteraction('mira', 'meal'),
    waitInteraction('kael', 'training'),
    waitInteraction('liora', 'recovery'),
  ]);
  const physical = await Promise.all(['mira', 'kael', 'liora'].map(heroState));
  diagnostics.physical = physical;
  assert.equal(physical[0].intent, 'eat');
  assert.equal(physical[0].animation, 'Sitting_Idle_Loop');
  assert.equal(physical[1].intent, 'train');
  assert.equal(physical[1].animation, 'Punch_Jab');
  assert.equal(physical[1].equipment, 'drawn');
  assert.equal(physical[2].intent, 'recover');
  assert.equal(physical[2].animation, 'Fixing_Kneeling');
  await page.screenshot({ path: 'interaction-polish-physical.png', fullPage: true });

  stage = 'social-and-solitude';
  await forceActions({
    mira: { actionId: 'help', targetId: 'kael' },
    kael: { actionId: 'apologize', targetId: 'mira' },
    liora: { actionId: 'seekSolitude' },
  });
  await Promise.all([
    waitInteraction('mira', 'care'),
    waitInteraction('kael', 'conversation'),
    waitInteraction('liora', 'solitude'),
  ]);
  const social = await Promise.all(['mira', 'kael', 'liora'].map(heroState));
  diagnostics.social = social;
  assert.equal(social[0].intent, 'help');
  assert.equal(social[0].animation, 'Fixing_Kneeling');
  assert.equal(social[1].intent, 'apologize');
  assert.equal(social[1].animation, 'Idle_Talking_Loop');
  assert.equal(social[2].intent, 'solitude');
  assert.equal(social[2].animation, 'Idle_Torch_Loop');

  stage = 'council-equipping';
  await forceCouncilPhase('equipping');
  await Promise.all([waitInteraction('mira', 'care'), waitInteraction('kael', 'care')]);
  const equipping = await Promise.all(['mira', 'kael'].map(heroState));
  diagnostics.equipping = equipping;
  for (const hero of equipping) {
    assert.equal(hero.intent, 'pack');
    assert.equal(hero.animation, 'PickUp_Table');
    assert.equal(hero.gesture, 'pack');
    assert.equal(hero.sceneProp, 'pack');
    assert.equal(hero.probeProp, 'pack');
  }

  stage = 'council-departure';
  await forceCouncilPhase('departure');
  await Promise.all([waitInteraction('mira', 'work'), waitInteraction('kael', 'work')]);
  const departure = await Promise.all(['mira', 'kael'].map(heroState));
  diagnostics.departure = departure;
  for (const hero of departure) {
    assert.equal(hero.intent, 'ready');
    assert.equal(hero.animation, 'Sword_Idle');
    assert.equal(hero.gesture, 'ready');
    assert.equal(hero.sceneProp, 'weapon');
    assert.equal(hero.equipment, 'drawn');
    assert.equal(hero.probeProp, 'weapon');
  }
  await page.screenshot({ path: 'interaction-polish-council.png', fullPage: true });

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  writeFileSync('interaction-polish-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors }, null, 2));
  console.log('Interaction Polish v1 browser smoke test passed.');
} catch (error) {
  writeFileSync('interaction-polish-diagnostics.json', JSON.stringify({
    ok: false,
    stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics,
    pageErrors,
  }, null, 2));
  console.error('Interaction Polish v1 browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'interaction-polish-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
