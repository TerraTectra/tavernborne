import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const storageKey = 'tavernborne.world.v2';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
const failedResponses = [];
const diagnostics = {};
let stage = 'startup';

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()); });
page.on('response', (response) => {
  if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
});

const waitCamp = async () => {
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor({ timeout: 25_000 });
  await page.waitForFunction((key) => Boolean(window.localStorage.getItem(key)), storageKey, { timeout: 20_000 });
  await page.getByTestId('camp-3d-layer').waitFor({ timeout: 25_000 });
  await page.getByTestId('camp-overlay-dock').waitFor({ timeout: 20_000 });
};

const injectLifeScene = async () => {
  await page.evaluate((key) => {
    const world = JSON.parse(window.localStorage.getItem(key));
    const tick = world.tick;
    world.visualScenes = { activeSceneId: undefined, scenes: [], nextId: 1 };
    world.lifeScenes = {
      activeSceneId: 'ui-foundation-life',
      scenes: [{
        id: 'ui-foundation-life',
        type: 'conversation',
        title: 'Обычный разговор у очага',
        status: 'active',
        phase: 'exchange',
        createdAt: tick,
        updatedAt: tick,
        participantIds: ['mira', 'kael'],
        roles: { mira: 'initiator', kael: 'target' },
        dialogue: [
          { id: 'ui-line-1', phase: 'opening', speakerId: 'mira', text: 'Как прошёл твой день?', tone: 'warm' },
          { id: 'ui-line-2', phase: 'exchange', speakerId: 'kael', text: 'Спокойно. Я закончил работу у мастерской и хотел узнать, как прошёл твой день у очага.', tone: 'neutral' },
        ],
        currentLineIndex: 1,
        initiatorId: 'mira',
        targetId: 'kael',
      }],
      nextId: 2,
      handledSocialSceneIds: [],
      handledExpeditionIds: [],
      handledJournalIds: [],
      handledMealKeys: [],
      handledTreatmentKeys: [],
      handledConflictDays: [],
    };
    window.localStorage.setItem(key, JSON.stringify(world));
  }, storageKey);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();
  await page.getByTestId('life-scene-panel').waitFor({ timeout: 20_000 });
  await page.getByTestId('dialogue-bubble-kael').waitFor({ timeout: 20_000 });
};

const rect = async (testId) => {
  const box = await page.getByTestId(testId).boundingBox();
  assert.ok(box, `${testId}: элемент не имеет видимого прямоугольника`);
  return box;
};

const intersects = (a, b) => !(
  a.x + a.width <= b.x
  || b.x + b.width <= a.x
  || a.y + a.height <= b.y
  || b.y + b.height <= a.y
);

const inside = (child, parent, tolerance = 2) => (
  child.x >= parent.x - tolerance
  && child.y >= parent.y - tolerance
  && child.x + child.width <= parent.x + parent.width + tolerance
  && child.y + child.height <= parent.y + parent.height + tolerance
);

const verifyLayout = async (label) => {
  const map = await rect('rts-map');
  const life = await rect('life-scene-panel');
  const body = await rect('physical-body-panel');
  const leadership = await rect('leadership-panel');
  const save = await rect('save-panel');
  const bubble = await rect('dialogue-bubble-kael');

  assert.ok(inside(life, map), `${label}: окно жизненной сцены вышло за карту`);
  assert.ok(inside(body, map), `${label}: телесная панель вышла за карту`);
  assert.ok(inside(leadership, map), `${label}: лидерская панель вышла за карту`);
  assert.equal(intersects(life, body), false, `${label}: жизненная и телесная панели перекрываются`);
  assert.equal(intersects(leadership, save), false, `${label}: лидерство перекрывает сохранения`);
  assert.ok(bubble.width >= 140, `${label}: реплика снова сжалась в вертикальный столб (${bubble.width}px)`);
  assert.ok(bubble.width <= 320, `${label}: реплика стала чрезмерно широкой (${bubble.width}px)`);
  assert.ok(bubble.height <= 150, `${label}: реплика закрывает слишком большую часть карты (${bubble.height}px)`);

  diagnostics[label] = { map, life, body, leadership, save, bubble };
};

const injectSleep = async () => {
  await page.evaluate((key) => {
    const world = JSON.parse(window.localStorage.getItem(key));
    world.lifeScenes = {
      activeSceneId: undefined,
      scenes: [],
      nextId: 1,
      handledSocialSceneIds: [],
      handledExpeditionIds: [],
      handledJournalIds: [],
      handledMealKeys: [],
      handledTreatmentKeys: [],
      handledConflictDays: [],
    };
    world.visualScenes = { activeSceneId: undefined, scenes: [], nextId: 1 };
    const mira = world.heroes.mira;
    mira.currentAction = { actionId: 'sleep', label: 'Отбой' };
    mira.currentActivity = {
      id: 'ui-sleep-activity',
      actionId: 'sleep',
      label: 'Отбой',
      startedAt: world.tick,
      remainingHours: 6,
    };
    mira.body.pose.name = 'resting';
    window.localStorage.setItem(key, JSON.stringify(world));
  }, storageKey);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();

  await page.waitForFunction(() => {
    const label = document.querySelector('[data-testid="hero-3d-mira"]');
    if (!label) return false;
    const x = Number(label.getAttribute('data-world-x'));
    const y = Number(label.getAttribute('data-world-y'));
    return label.getAttribute('data-animation-intent') === 'sleep'
      && label.getAttribute('data-interaction-posture') === 'resting'
      && label.getAttribute('data-body-pose') === 'resting'
      && Math.abs(x - 72.7) < 0.9
      && Math.abs(y - 20.2) < 0.9;
  }, undefined, { timeout: 20_000 });

  const label = page.getByTestId('hero-3d-mira');
  diagnostics.sleep = {
    animationIntent: await label.getAttribute('data-animation-intent'),
    posture: await label.getAttribute('data-interaction-posture'),
    bodyPose: await label.getAttribute('data-body-pose'),
    worldX: await label.getAttribute('data-world-x'),
    worldY: await label.getAttribute('data-world-y'),
  };
};

try {
  stage = 'open';
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitCamp();

  stage = 'desktop-layout';
  await injectLifeScene();
  await page.waitForTimeout(900);
  await verifyLayout('desktop-1920x1080');
  await page.screenshot({ path: 'physical-ui-desktop.png', fullPage: true });

  stage = 'compact-layout';
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(500);
  await verifyLayout('compact-1366x768');
  await page.screenshot({ path: 'physical-ui-compact.png', fullPage: true });

  stage = 'sleep-body';
  await page.setViewportSize({ width: 1920, height: 1080 });
  await injectSleep();
  await page.screenshot({ path: 'physical-ui-sleep.png', fullPage: true });

  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);
  assert.equal(failedResponses.length, 0, `HTTP-ошибки: ${failedResponses.map((item) => `${item.status} ${item.url}`).join(' | ')}`);

  writeFileSync('physical-ui-diagnostics.json', JSON.stringify({ stage: 'passed', diagnostics, pageErrors, failedResponses }, null, 2));
  console.log('Physical UI foundation browser smoke passed.');
} catch (error) {
  writeFileSync('physical-ui-diagnostics.json', JSON.stringify({
    stage,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    diagnostics,
    pageErrors,
    failedResponses,
  }, null, 2));
  console.error('Physical UI foundation browser smoke failed:', error);
  throw error;
} finally {
  await browser.close();
}
