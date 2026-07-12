import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
const pageErrors = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const advanceHour = async (wait = 320) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click();
  await page.waitForTimeout(wait);
};

const attribute = (testId, name) => page.getByTestId(testId).getAttribute(name);

try {
  console.log(`Opening visual dungeon exploration at ${testUrl}...`);
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();

  await page.getByRole('button', { name: 'x1', exact: true }).click();
  await page.getByRole('button', { name: 'x2', exact: true }).click();

  console.log('Advancing through breakfast and visible expedition council...');
  await advanceHour(1700); // 07:00 breakfast
  await advanceHour(1700); // 08:00 council gathering
  for (let hour = 0; hour < 5; hour += 1) await advanceHour(900); // briefing -> departure -> dungeon

  const overlay = page.getByTestId('dungeon-visual-overlay');
  await overlay.waitFor({ timeout: 7000 });
  const map = page.getByTestId('dungeon-rts-map');
  await map.waitFor();
  assert.ok((await page.getByTestId('dungeon-phase').textContent())?.includes('Вход на этаж'), 'Карта не начала фазу входа');
  assert.equal(await attribute('dungeon-room-entrance', 'data-discovered'), 'true', 'Вход не открыт');
  assert.equal(await page.getByTestId('dungeon-fog-count').textContent(), '6', 'Начальный туман войны неверен');
  assert.equal(await page.locator('[data-testid^="dungeon-party-"]').count(), 3, 'На карте нет всей группы');
  assert.equal(await page.locator('[data-role="scout"]').count(), 1, 'Не показан разведчик');
  assert.equal(await page.locator('[data-role="leader"]').count(), 1, 'Не показан лидер группы');

  const scout = page.locator('[data-role="scout"]').first();
  const scoutId = await scout.getAttribute('data-testid');
  const scoutXAtEntrance = Number(await scout.getAttribute('data-x'));
  const scoutYAtEntrance = Number(await scout.getAttribute('data-y'));

  console.log('Checking formation movement and fog reveal...');
  await advanceHour(1600);
  assert.ok((await page.getByTestId('dungeon-phase').textContent())?.includes('Разведка'), 'Нет фазы разведки');
  assert.equal(await attribute('dungeon-room-hall', 'data-discovered'), 'true', 'Коридор не раскрыт разведчиком');
  const movedScout = page.getByTestId(scoutId.replace('dungeon-party-', 'dungeon-party-'));
  const scoutXInHall = Number(await movedScout.getAttribute('data-x'));
  const scoutYInHall = Number(await movedScout.getAttribute('data-y'));
  assert.ok(Math.hypot(scoutXInHall - scoutXAtEntrance, scoutYInHall - scoutYAtEntrance) > 8, 'Разведчик не переместился по карте');

  console.log('Checking autonomous route choice...');
  await advanceHour(1500);
  assert.ok((await page.getByTestId('dungeon-phase').textContent())?.includes('Выбор маршрута'), 'Лидер не выбирает маршрут');
  assert.equal(await attribute('dungeon-room-fork', 'data-discovered'), 'true', 'Развилка не раскрыта');
  const routeDecision = await page.getByTestId('dungeon-route-decision').textContent();
  assert.ok(routeDecision?.includes('маршрут:'), 'Выбранный маршрут не показан');

  console.log('Checking trap or safe detour...');
  await advanceHour(1500);
  const trapDiscovered = await attribute('dungeon-room-trap', 'data-discovered') === 'true';
  const refugeDiscovered = await attribute('dungeon-room-refuge', 'data-discovered') === 'true';
  assert.ok(trapDiscovered || refugeDiscovered, 'Группа не прошла ни один маршрут');
  if (trapDiscovered) {
    assert.ok(await page.locator('.dungeon-trap').count() >= 1, 'Ловушка не показана визуально');
    assert.ok((await page.getByTestId('dungeon-route-decision').textContent())?.includes('ловушка:'), 'Результат проверки ловушки не показан');
  }

  console.log('Checking chest discovery and visual looting...');
  await advanceHour(1500);
  assert.ok((await page.getByTestId('dungeon-phase').textContent())?.includes('Осмотр находки'), 'Нет фазы осмотра находки');
  assert.equal(await attribute('dungeon-room-cache', 'data-discovered'), 'true', 'Кладовая не раскрыта');
  assert.ok(await page.locator('.dungeon-chest-open').count() >= 1, 'Сундук не открыт визуально');
  assert.ok((await page.getByTestId('dungeon-route-decision').textContent())?.includes('сундук открыт'), 'Находка не отражена в решении группы');

  console.log('Checking enemy assessment without combat...');
  await advanceHour(1500);
  assert.ok((await page.getByTestId('dungeon-phase').textContent())?.includes('Оценка угрозы'), 'Нет оценки угрозы');
  assert.equal(await attribute('dungeon-room-enemy', 'data-discovered'), 'true', 'Комната врага не раскрыта');
  assert.ok(await page.locator('.dungeon-enemy').count() >= 1, 'Страж не показан на карте');
  const threatDecision = await page.getByTestId('dungeon-route-decision').textContent();
  assert.ok(threatDecision?.includes('решение: обойти') || threatDecision?.includes('решение: отступить'), 'Лидер не принял решение о враге');
  assert.ok(!threatDecision?.toLowerCase().includes('победил в бою'), 'Прототип неожиданно запустил полноценный бой');

  console.log('Checking return formation and help for a lagging member...');
  await advanceHour(1500);
  assert.ok((await page.getByTestId('dungeon-phase').textContent())?.includes('Возвращение'), 'Группа не начала возвращение');
  const returnText = await page.getByTestId('dungeon-route-decision').textContent();
  assert.ok(returnText?.includes('отставать') || returnText?.includes('поддержал'), 'Помощь отставшему не произошла');
  assert.ok(await page.locator('[data-status="helping"]').count() >= 1, 'Поддержка не показана в строю');

  console.log('Checking physical exit, persistence and return to camp...');
  await advanceHour(1900);
  await page.getByTestId('dungeon-visual-overlay').waitFor({ state: 'detached', timeout: 7000 });
  const dungeonPanelText = await page.getByTestId('dungeon-panel').textContent();
  assert.ok(dungeonPanelText?.includes('Завершён') || dungeonPanelText?.includes('Отступление'), 'Экспедиция не завершилась');

  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2')));
  const expedition = saved.expeditions.find((candidate) => candidate.exploration);
  assert.ok(expedition?.exploration, 'Карта подземелья не попала в сохранение');
  assert.equal(expedition.exploration.rooms.length, 7, 'Сохранён неверный набор комнат');
  assert.ok(expedition.exploration.discoveredRoomIds.length >= 5, 'История раскрытия тумана потеряна');
  assert.ok(expedition.exploration.decisions.length >= 5, 'Решения группы не сохранены');
  assert.equal(expedition.exploration.chestOpened, true, 'Состояние сундука не сохранено');
  assert.equal(expedition.exploration.enemySpotted, true, 'Встреча с врагом не сохранена');
  assert.ok(expedition.exploration.routeChoice, 'Выбор маршрута не сохранён');
  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);

  console.log('Visual dungeon exploration browser smoke test passed.');
} catch (error) {
  console.error('Visual dungeon exploration browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'dungeon-exploration-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
