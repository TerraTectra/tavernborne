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

const waitBubble = async (id, fragment) => {
  await page.waitForFunction(
    ({ heroId, expected }) => {
      const label = document.querySelector(`[data-testid="hero-3d-${heroId}"]`);
      const bubble = document.querySelector(`[data-testid="dialogue-bubble-${heroId}"]`);
      return label?.getAttribute('data-dialogue-is-speaker') === 'true'
        && Boolean(bubble?.textContent?.includes(expected));
    },
    { heroId: id, expected: fragment },
    { timeout: 35_000 },
  );
};

const stateOf = async (id) => {
  const label = page.getByTestId(`hero-3d-${id}`);
  const bubble = page.getByTestId(`dialogue-bubble-${id}`);
  return {
    id,
    performance: await label.getAttribute('data-dialogue-performance'),
    tone: await label.getAttribute('data-dialogue-tone'),
    cadence: await label.getAttribute('data-dialogue-cadence'),
    reason: await label.getAttribute('data-dialogue-reason'),
    wordCount: Number(await label.getAttribute('data-dialogue-word-count')),
    text: (await bubble.textContent())?.trim() ?? '',
  };
};

const lifeScene = ({ id, lines, currentLineIndex, type = 'conversation' }) => ({
  id,
  type,
  title: 'Проверка непрерывности разговора',
  status: 'active',
  phase: lines[currentLineIndex].phase,
  createdAt: 10,
  updatedAt: 10,
  participantIds: ['mira', 'kael'],
  roles: { mira: 'initiator', kael: 'target' },
  dialogue: lines.map((line, index) => ({ id: `${id}-line-${index}`, ...line })),
  currentLineIndex,
  initiatorId: 'mira',
  targetId: 'kael',
});

const councilScene = ({ id, lines, currentLineIndex }) => ({
  id,
  type: 'expeditionCouncil',
  title: 'Совет перед походом',
  status: 'active',
  phase: lines[currentLineIndex].phase,
  createdAt: 10,
  updatedAt: 10,
  expeditionId: 'exp-continuity',
  leaderId: 'kael',
  participantIds: ['mira', 'kael'],
  partyIds: ['mira', 'kael'],
  roles: { mira: 'scout', kael: 'leader' },
  responses: { mira: 'questioned', kael: 'accepted' },
  dialogue: lines.map((line, index) => ({ id: `${id}-line-${index}`, ...line })),
  currentLineIndex,
});

const setWorld = async ({ traits = {}, emotions = {}, psyche = {}, relation = {}, scene, kind = 'life' }) => {
  await page.evaluate((config) => {
    const key = 'tavernborne.world.v2';
    const world = JSON.parse(window.localStorage.getItem(key));
    const mira = world.heroes.mira;

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
    Object.assign(mira.relationships.kael.values, config.relation);
    world.socialScenes = [];

    if (config.kind === 'visual') {
      world.lifeScenes = {
        scenes: [], nextId: 1,
        handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
        handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
      };
      world.visualScenes = { activeSceneId: config.scene.id, scenes: [config.scene], nextId: 2 };
    } else {
      world.visualScenes = { scenes: [], nextId: 1 };
      world.lifeScenes = {
        activeSceneId: config.scene.id,
        scenes: [config.scene],
        nextId: 2,
        handledSocialSceneIds: [], handledExpeditionIds: [], handledJournalIds: [],
        handledMealKeys: [], handledTreatmentKeys: [], handledConflictDays: [],
      };
    }

    window.localStorage.setItem(key, JSON.stringify(world));
  }, { traits, emotions, psyche, relation, scene, kind });

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

  stage = 'opening';
  await setWorld({
    scene: lifeScene({
      id: 'continuity-opening', currentLineIndex: 0,
      lines: [{ phase: 'opening', speakerId: 'mira', text: 'Я хочу обсудить путь к северным воротам.', tone: 'neutral' }],
    }),
  });
  await waitBubble('mira', 'Я хочу обсудить путь');
  const opening = await stateOf('mira');
  diagnostics.opening = opening;
  assert.equal(opening.text, 'Я хочу обсудить путь к северным воротам.');
  assert.ok(!opening.text.includes('«'));

  stage = 'answer';
  await setWorld({
    scene: lifeScene({
      id: 'continuity-answer', currentLineIndex: 1,
      lines: [
        { phase: 'exchange', speakerId: 'kael', text: 'Почему ты изменила маршрут?', tone: 'neutral' },
        { phase: 'exchange', speakerId: 'mira', text: 'Северный мост обрушился, поэтому пришлось идти через лес.', tone: 'neutral' },
      ],
    }),
  });
  await waitBubble('mira', 'На слова «Почему ты изменила маршрут»');
  const answer = await stateOf('mira');
  diagnostics.answer = answer;
  assert.ok(answer.text.startsWith('На слова «Почему ты изменила маршрут» отвечу прямо:'));
  assert.ok(answer.text.includes('северный мост обрушился'));

  stage = 'acknowledge';
  await setWorld({
    traits: { kindness: 100, friendliness: 96, empathy: 94 },
    emotions: { affection: 88 },
    relation: { closeness: 90, liking: 86, trust: 82 },
    scene: lifeScene({
      id: 'continuity-acknowledge', currentLineIndex: 1,
      lines: [
        { phase: 'exchange', speakerId: 'kael', text: 'Я боюсь, что мы потеряем ещё одного человека.', tone: 'neutral' },
        { phase: 'exchange', speakerId: 'mira', text: 'Мы пойдём медленнее и будем проверять каждый поворот.', tone: 'warm' },
      ],
    }),
  });
  await waitBubble('mira', 'Я услышал тебя: «Я боюсь, что мы потеряем ещё одного человека»');
  const acknowledge = await stateOf('mira');
  diagnostics.acknowledge = acknowledge;
  assert.equal(acknowledge.performance, 'warm');
  assert.ok(acknowledge.text.includes('Каэль,'));
  await page.screenshot({ path: 'conversation-continuity-acknowledge.png', fullPage: true });

  stage = 'build';
  await setWorld({
    scene: lifeScene({
      id: 'continuity-build', currentLineIndex: 1, type: 'debrief',
      lines: [
        { phase: 'opening', speakerId: 'mira', text: 'Сначала проверим припасы.', tone: 'firm' },
        { phase: 'opening', speakerId: 'mira', text: 'После этого распределим роли.', tone: 'firm' },
      ],
    }),
  });
  await waitBubble('mira', 'Продолжу эту мысль:');
  const build = await stateOf('mira');
  diagnostics.build = build;
  assert.ok(build.text.startsWith('Продолжу эту мысль:'));
  assert.ok(build.text.includes('после этого распределим роли'));

  stage = 'challenge';
  await setWorld({
    traits: { independence: 100, pride: 96, ambition: 90 },
    emotions: { anger: 66 },
    relation: { rivalry: 96, envy: 72 },
    scene: lifeScene({
      id: 'continuity-challenge', currentLineIndex: 1, type: 'conflict',
      lines: [
        { phase: 'exchange', speakerId: 'kael', text: 'Ты должна принять мой план без вопросов.', tone: 'firm' },
        { phase: 'exchange', speakerId: 'mira', text: 'Я отвечаю за разведку и вижу риск.', tone: 'tense' },
      ],
    }),
  });
  await waitBubble('mira', 'Не могу согласиться со словами «Ты должна принять мой план без вопросов»');
  const challenge = await stateOf('mira');
  diagnostics.challenge = challenge;
  assert.equal(challenge.performance, 'defiant');
  assert.ok(challenge.text.includes('не уступлю'));
  await page.screenshot({ path: 'conversation-continuity-challenge.png', fullPage: true });

  stage = 'repair';
  await setWorld({
    emotions: { guilt: 92, shame: 76, sadness: 54 },
    scene: lifeScene({
      id: 'continuity-repair', currentLineIndex: 1, type: 'apology',
      lines: [
        { phase: 'exchange', speakerId: 'kael', text: 'Ты ушла, когда мне нужна была поддержка.', tone: 'hurt' },
        { phase: 'exchange', speakerId: 'mira', text: 'Я ошиблась и хочу исправить это.', tone: 'apologetic' },
      ],
    }),
  });
  await waitBubble('mira', 'Я понимаю, что за словами «Ты ушла, когда мне нужна была поддержка» стоит боль');
  const repair = await stateOf('mira');
  diagnostics.repair = repair;
  assert.ok(repair.text.includes('Я ошиблась'));
  await page.screenshot({ path: 'conversation-continuity-repair.png', fullPage: true });

  stage = 'conclude';
  await setWorld({
    scene: lifeScene({
      id: 'continuity-conclude', currentLineIndex: 1,
      lines: [
        { phase: 'exchange', speakerId: 'kael', text: 'Тогда договорились менять караул каждые четыре часа.', tone: 'neutral' },
        { phase: 'resolution', speakerId: 'mira', text: 'Хорошо. Начнём с сегодняшней ночи.', tone: 'warm' },
      ],
    }),
  });
  await waitBubble('mira', 'Значит, по теме «личный разговор» главное сказано');
  const conclude = await stateOf('mira');
  diagnostics.conclude = conclude;
  assert.ok(conclude.text.includes('Начнём с сегодняшней ночи'));

  stage = 'council-thread';
  await setWorld({
    traits: { caution: 96, patience: 78 },
    emotions: { anxiety: 70 },
    kind: 'visual',
    scene: councilScene({
      id: 'continuity-council', currentLineIndex: 1,
      lines: [
        { phase: 'assigning', speakerId: 'kael', text: 'Мира, ты пойдёшь впереди и отметишь безопасный путь.', tone: 'firm' },
        { phase: 'assigning', speakerId: 'mira', text: 'Я согласна, но попрошу дать мне время проверить боковой проход.', tone: 'doubtful' },
      ],
    }),
  });
  await waitBubble('mira', 'Я услышал тебя: «Мира, ты пойдёшь впереди и отметишь безопасный путь»');
  const council = await stateOf('mira');
  diagnostics.council = council;
  assert.equal(council.performance, 'careful');
  assert.ok(council.text.includes('боковой проход'));
  await page.screenshot({ path: 'conversation-continuity-council.png', fullPage: true });

  stage = 'errors';
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `Failed responses: ${failedResponses.map((entry) => `${entry.status} ${entry.url}`).join(' | ')}`);
  writeFileSync('conversation-continuity-diagnostics.json', JSON.stringify({ ok: true, stage, diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Conversation Continuity v1 browser smoke test passed.');
} catch (error) {
  writeFileSync('conversation-continuity-diagnostics.json', JSON.stringify({
    ok: false, stage,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    diagnostics, pageErrors, failedResponses,
  }, null, 2));
  console.error('Conversation Continuity v1 browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'conversation-continuity-final.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
