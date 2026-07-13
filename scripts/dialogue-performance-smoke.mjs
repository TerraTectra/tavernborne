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

const waitDialogue = async (id, performance) => {
  await page.waitForFunction(
    ({ heroId, expected }) => {
      const label = document.querySelector(`[data-testid="hero-3d-${heroId}"]`);
      const bubble = document.querySelector(`[data-testid="dialogue-bubble-${heroId}"]`);
      return label?.getAttribute('data-dialogue-performance') === expected
        && label?.getAttribute('data-dialogue-is-speaker') === 'true'
        && Boolean(bubble?.textContent?.trim());
    },
    { heroId: id, expected: performance },
    { timeout: 35_000 },
  );
};

const stateOf = async (id) => {
  const label = page.getByTestId(`hero-3d-${id}`);
  const bubble = page.getByTestId(`dialogue-bubble-${id}`);
  return {
    id,
    performance: await label.getAttribute('data-dialogue-performance'),
    length: await label.getAttribute('data-dialogue-length'),
    cadence: await label.getAttribute('data-dialogue-cadence'),
    tone: await label.getAttribute('data-dialogue-tone'),
    wordCount: Number(await label.getAttribute('data-dialogue-word-count')),
    memoryId: await label.getAttribute('data-dialogue-memory-id'),
    partnerId: await label.getAttribute('data-dialogue-partner-id'),
    reason: await label.getAttribute('data-dialogue-reason'),
    text: (await bubble.textContent())?.trim() ?? '',
  };
};

const sceneFor = ({ id, text, tone = 'neutral', type = 'conversation', role = 'initiator' }) => ({
  id,
  type,
  title: 'Проверка речи',
  status: 'active',
  phase: type === 'debrief' ? 'opening' : 'exchange',
  createdAt: 10,
  updatedAt: 10,
  participantIds: ['mira', 'kael'],
  roles: { mira: role, kael: type === 'debrief' ? 'member' : 'target' },
  dialogue: [{ id: `${id}-line`, phase: type === 'debrief' ? 'opening' : 'exchange', speakerId: 'mira', text, tone }],
  currentLineIndex: 0,
  initiatorId: 'mira',
  targetId: 'kael',
});

const setWorld = async ({ traits = {}, emotions = {}, psyche = {}, needs = {}, relation = {}, memory, leadership, scene }) => {
  await page.evaluate((config) => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    const mira = world.heroes.mira;
    const kael = world.heroes.kael;

    for (const hero of Object.values(world.heroes)) {
      Object.keys(hero.traits).forEach((name) => { hero.traits[name] = 0; });
      Object.keys(hero.emotions).forEach((name) => { hero.emotions[name] = 0; });
      Object.keys(hero.needs).forEach((name) => { hero.needs[name] = 0; });
      Object.keys(hero.psyche).forEach((name) => { hero.psyche[name] = 0; });
      hero.psyche.security = 100;
      hero.condition.injury = 0;
      hero.body.tissues.muscleFatigue = 0;
      hero.currentAction = undefined;
      hero.currentActivity = undefined;
      hero.memories = [];
      Object.values(hero.relationships).forEach((entry) => Object.keys(entry.values).forEach((name) => { entry.values[name] = 0; }));
    }

    Object.assign(mira.traits, config.traits);
    Object.assign(mira.emotions, config.emotions);
    Object.assign(mira.psyche, config.psyche);
    Object.assign(mira.needs, config.needs);
    Object.assign(mira.relationships.kael.values, config.relation);
    if (config.memory) mira.memories = [config.memory];

    if (world.leadership) {
      world.leadership.familyLeaderId = config.leadership?.familyLeaderId;
      for (const person of Object.values(world.leadership.people ?? {})) {
        person.role = 'follower';
        Object.values(person.bonds ?? {}).forEach((bond) => {
          bond.authority = 0; bond.obedience = 0; bond.politicalLoyalty = 0;
          bond.confidence = 50; bond.grievance = 0; bond.groupBond = 0;
        });
      }
      if (config.leadership?.familyLeaderId === 'mira' && world.leadership.people.mira) world.leadership.people.mira.role = 'leader';
      if (config.leadership?.challenger && world.leadership.people.mira) world.leadership.people.mira.role = 'challenger';
    }

    world.visualScenes = { scenes: [], nextId: 1 };
    world.socialScenes = [];
    world.lifeScenes = {
      activeSceneId: config.scene.id,
      scenes: [config.scene],
      nextId: 2,
      handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
      handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
    };
    window.localStorage.setItem(key, JSON.stringify(world));
  }, { traits, emotions, psyche, needs, relation, memory, leadership, scene });

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

  stage = 'blunt';
  await setWorld({
    traits: { honesty: 100, independence: 96, impulsiveness: 92, pride: 70 },
    scene: sceneFor({ id: 'dialogue-blunt', text: 'Мне кажется, нам нужно изменить порядок дежурств. Так будет справедливее.' }),
  });
  await waitDialogue('mira', 'blunt');
  const blunt = await stateOf('mira');
  diagnostics.blunt = blunt;
  assert.equal(blunt.length, 'terse');
  assert.equal(blunt.cadence, 'clipped');
  assert.ok(blunt.text.startsWith('Скажу прямо:'));
  assert.ok(blunt.wordCount <= 18);

  stage = 'warm';
  await setWorld({
    traits: { kindness: 100, friendliness: 96, empathy: 94, patience: 70 },
    emotions: { affection: 88, joy: 50 },
    relation: { closeness: 92, liking: 88, trust: 82 },
    scene: sceneFor({ id: 'dialogue-warm', text: 'Я хочу обсудить то, что произошло утром.', tone: 'warm' }),
  });
  await waitDialogue('mira', 'warm');
  const warm = await stateOf('mira');
  diagnostics.warm = warm;
  assert.equal(warm.length, 'expanded');
  assert.equal(warm.cadence, 'flowing');
  assert.equal(warm.tone, 'warm');
  assert.ok(warm.text.startsWith('Каэль,'));
  assert.ok(warm.text.includes('важно'));
  assert.ok(warm.wordCount > blunt.wordCount);
  await page.screenshot({ path: 'dialogue-performance-warm.png', fullPage: true });

  stage = 'hesitant';
  await setWorld({
    traits: { approvalSeeking: 100, caution: 38 },
    emotions: { fear: 94, guilt: 88, shame: 84 },
    psyche: { security: 10, stress: 78 },
    relation: { fear: 88 },
    scene: sceneFor({ id: 'dialogue-hesitant', text: 'Мне нужно признаться, что я ошиблась.', tone: 'apologetic' }),
  });
  await waitDialogue('mira', 'hesitant');
  const hesitant = await stateOf('mira');
  diagnostics.hesitant = hesitant;
  assert.equal(hesitant.cadence, 'halting');
  assert.equal(hesitant.tone, 'apologetic');
  assert.ok(hesitant.text.startsWith('Я…'));

  stage = 'reflective-memory';
  const reflectiveMemory = {
    id: 'memory-shared-watch', summary: 'Ночная смена: Каэль остался рядом, когда Мира едва держалась на ногах.',
    createdAt: 8, importance: 96, valence: 72, participants: ['kael'], tags: ['social', 'support'], sourceEventType: 'social',
  };
  await setWorld({
    traits: { curiosity: 100, patience: 100, honesty: 80 },
    memory: reflectiveMemory,
    scene: sceneFor({ id: 'dialogue-reflective', text: 'Нам стоит снова распределить ночные смены вместе.' }),
  });
  await waitDialogue('mira', 'reflective');
  const reflective = await stateOf('mira');
  diagnostics.reflective = reflective;
  assert.equal(reflective.length, 'expanded');
  assert.equal(reflective.memoryId, reflectiveMemory.id);
  assert.ok(reflective.text.startsWith('Я помню:'));
  assert.ok(reflective.text.includes('остался рядом'));
  await page.screenshot({ path: 'dialogue-performance-memory.png', fullPage: true });

  stage = 'wounded-memory';
  const woundedMemory = {
    id: 'memory-broken-promise', summary: 'Ссора у ворот: Каэль нарушил обещание и ушёл, когда Мира просила остаться.',
    createdAt: 9, importance: 98, valence: -90, participants: ['kael'], tags: ['social', 'conflict'], sourceEventType: 'social',
  };
  await setWorld({
    traits: { honesty: 42, vengefulness: 80 },
    emotions: { sadness: 92, anger: 68 },
    relation: { resentment: 94, trust: -55 },
    memory: woundedMemory,
    scene: sceneFor({ id: 'dialogue-wounded', text: 'Ты снова просишь меня поверить тебе.', tone: 'hurt' }),
  });
  await waitDialogue('mira', 'wounded');
  const wounded = await stateOf('mira');
  diagnostics.wounded = wounded;
  assert.equal(wounded.tone, 'hurt');
  assert.equal(wounded.memoryId, woundedMemory.id);
  assert.ok(wounded.text.startsWith('После того, как'));
  assert.ok(wounded.text.includes('нарушил обещание'));
  await page.screenshot({ path: 'dialogue-performance-wounded.png', fullPage: true });

  stage = 'commanding-leader';
  await setWorld({
    traits: { discipline: 100, ambition: 94, honesty: 72 },
    psyche: { confidence: 96, security: 100 },
    leadership: { familyLeaderId: 'mira' },
    scene: sceneFor({ id: 'dialogue-commanding', text: 'Сначала проверим припасы, затем распределим роли.', tone: 'firm', type: 'debrief', role: 'leader' }),
  });
  await waitDialogue('mira', 'commanding');
  const commanding = await stateOf('mira');
  diagnostics.commanding = commanding;
  assert.equal(commanding.length, 'terse');
  assert.equal(commanding.cadence, 'clipped');
  assert.equal(commanding.tone, 'firm');
  assert.ok(commanding.text.startsWith('Решение такое:'));
  await page.screenshot({ path: 'dialogue-performance-leader.png', fullPage: true });

  stage = 'defiant';
  await setWorld({
    traits: { independence: 100, pride: 96, ambition: 90 },
    emotions: { anger: 65 },
    relation: { rivalry: 96, envy: 72 },
    leadership: { familyLeaderId: 'kael', challenger: true },
    scene: sceneFor({ id: 'dialogue-defiant', text: 'Я не согласна с этим распределением.', tone: 'tense' }),
  });
  await waitDialogue('mira', 'defiant');
  const defiant = await stateOf('mira');
  diagnostics.defiant = defiant;
  assert.equal(defiant.cadence, 'clipped');
  assert.equal(defiant.tone, 'tense');
  assert.ok(defiant.text.startsWith('Нет.'));
  assert.ok(defiant.text.includes('не уступлю'));

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `Failed responses: ${failedResponses.map((entry) => `${entry.status} ${entry.url}`).join(' | ')}`);
  writeFileSync('dialogue-performance-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Dialogue Performance v1 browser smoke test passed.');
} catch (error) {
  writeFileSync('dialogue-performance-diagnostics.json', JSON.stringify({
    ok: false, stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics, pageErrors, failedResponses,
  }, null, 2));
  console.error('Dialogue Performance v1 browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'dialogue-performance-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
