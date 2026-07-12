import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 }, acceptDownloads: true });
const pageErrors = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const actorAttribute = (heroId, attribute) =>
  page.getByTestId(`actor-${heroId}`).getAttribute(attribute);

const advanceHour = async (wait = 100) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click();
  await page.waitForTimeout(wait);
};

try {
  console.log('Opening seeded social RTS simulation...');
  await page.goto('http://127.0.0.1:4173/tavernborne/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await page.getByTestId('rts-map').waitFor();
  await page.getByTestId('day-plan').waitFor();
  await page.getByTestId('dungeon-panel').waitFor();
  await page.getByTestId('save-panel').waitFor();
  await page.getByTestId('social-scenes-panel').waitFor();

  const bodyBefore = await page.textContent('body');
  for (const name of ['Астер', 'Мира', 'Каэль', 'Лиора']) {
    assert.ok(bodyBefore?.includes(name), `Не найден персонаж: ${name}`);
  }
  assert.ok(bodyBefore?.includes('Общий завтрак'), 'Не создан общий распорядок');
  assert.ok(bodyBefore?.includes('seed: aster-family-001'), 'Не отображается seed');
  assert.ok(!bodyBefore?.includes('Черты личности'), 'Внутренняя модель видна без открытия');
  assert.equal(await page.locator('.rts-head').count(), 3, 'Не отрисованы фигуры героев');

  await page.getByRole('button', { name: 'x1', exact: true }).click();
  await page.getByRole('button', { name: 'x2', exact: true }).click();

  console.log('Checking synchronized breakfast...');
  await advanceHour(1700);
  const breakfastActions = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorAttribute(id, 'data-action')));
  assert.deepEqual(breakfastActions, ['eat', 'eat', 'eat'], 'Семья не собралась на завтрак');
  assert.equal(await page.locator('.rts-bowl').count(), 3, 'Не показана совместная еда');

  console.log('Checking dungeon cycle...');
  await advanceHour(500);
  await advanceHour(2600);
  const phasesAtDeparture = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorAttribute(id, 'data-phase')));
  assert.ok(phasesAtDeparture.filter((phase) => phase === 'away').length >= 2, 'Группа не покинула карту');
  assert.ok((await page.getByTestId('dungeon-panel').textContent())?.includes('В подземелье'), 'Поход не активен');
  await advanceHour();
  const dungeonEvent = (await page.getByTestId('dungeon-panel').textContent())?.toLowerCase();
  assert.ok(['бой', 'проход', 'находк', 'паёк', 'доверие', 'монстр'].some((part) => dungeonEvent?.includes(part)), 'Нет события подземелья');
  for (let hour = 0; hour < 6; hour += 1) await advanceHour();
  await page.waitForTimeout(2600);
  const returned = await page.getByTestId('dungeon-panel').textContent();
  assert.ok(returned?.includes('Завершён') || returned?.includes('Отступление'), 'Поход не завершился');

  console.log('Checking negotiated social scene...');
  await advanceHour();
  await advanceHour(500);
  const socialText = await page.getByTestId('social-scenes-panel').textContent();
  assert.ok(socialText?.includes('Разговор') || socialText?.includes('Совместная помощь') || socialText?.includes('Попытка примирения'), 'Социальная сцена не создана');
  assert.ok(socialText?.includes('согласие') || socialText?.includes('перенос') || socialText?.includes('отказ'), 'Нет ответа на предложение');

  console.log('Checking save, autosave and load...');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const savedTick = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2')).tick);
  await advanceHour();
  await page.waitForFunction(
    ({ key, previous }) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw).tick > previous : false;
    },
    { key: 'tavernborne.world.v2', previous: savedTick },
  );
  await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
  await page.waitForTimeout(250);
  assert.ok((await page.getByTestId('save-panel').textContent())?.includes('сохранение загружено'), 'Загрузка не подтверждена');

  console.log('Checking history and hidden diagnostics...');
  await page.getByRole('button', { name: 'Открыть историю героя', exact: true }).click();
  await page.getByTestId('hero-history').waitFor();
  await page.getByRole('button', { name: 'Открыть внутреннюю модель и события', exact: true }).click();
  const inner = page.getByTestId('inner-model');
  await inner.waitFor();
  const innerText = await inner.textContent();
  for (const section of ['Все эмоции', 'Черты личности', 'Потребности', 'Психика', 'Отношения', 'Воспоминания']) {
    assert.ok(innerText?.includes(section), `Не раскрыт раздел: ${section}`);
  }

  console.log('Checking diagnostic export and new seed...');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().startsWith('tavernborne-'), 'Неверное имя экспорта');
  await page.getByLabel('Seed мира').fill('social-test-777');
  await page.getByRole('button', { name: 'Новый мир', exact: true }).click();
  await page.waitForTimeout(250);
  assert.ok((await page.getByTestId('world-seed').textContent())?.includes('social-test-777'), 'Seed не применился');

  await page.getByRole('button', { name: 'Открыть внутреннюю модель и события', exact: true }).click();
  await page.getByRole('button', { name: 'Похвалить', exact: true }).click();
  await page.getByRole('button', { name: 'Показать журнал событий', exact: true }).click();
  await page.getByTestId('journal-panel').waitFor();
  assert.ok((await page.getByTestId('journal-panel').textContent())?.includes('Астер похвалил'), 'Событие не попало в журнал');
  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);

  console.log('Seeded saves and social scenes browser smoke test passed.');
} catch (error) {
  console.error('Seeded saves and social scenes browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'rts-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
