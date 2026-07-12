import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 }, acceptDownloads: true });
const pageErrors = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const actorPosition = async (heroId) => {
  const actor = page.getByTestId(`actor-${heroId}`);
  return {
    x: Number(await actor.getAttribute('data-x')),
    y: Number(await actor.getAttribute('data-y')),
  };
};

const actorAttribute = (heroId, attribute) =>
  page.getByTestId(`actor-${heroId}`).getAttribute(attribute);

const advanceHour = async (wait = 90) => {
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
  assert.ok(bodyBefore?.includes('Общий завтрак'), 'Не создан общий семейный распорядок');
  assert.ok(bodyBefore?.includes('Экспедиция на 1-й этаж'), 'Не создан план первой экспедиции');
  assert.ok(bodyBefore?.includes('seed: aster-family-001'), 'Не отображается seed мира');
  assert.ok(!bodyBefore?.includes('Черты личности'), 'Внутренние параметры не скрыты под вуалью');
  assert.equal(await page.locator('.rts-head').count(), 3, 'Персонажи не отрисованы как фигуры');

  await page.getByRole('button', { name: 'x1', exact: true }).click();
  await page.getByRole('button', { name: 'x2', exact: true }).click();
  const positionsBefore = await Promise.all(['mira', 'kael', 'liora'].map(actorPosition));

  console.log('Checking synchronized breakfast...');
  await advanceHour(1700);
  const breakfastActions = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorAttribute(id, 'data-action')));
  assert.deepEqual(breakfastActions, ['eat', 'eat', 'eat'], 'Семья не собралась на общий завтрак');
  assert.equal(await page.locator('.rts-bowl').count(), 3, 'Не показано совместное принятие пищи');
  const positionsAfter = await Promise.all(['mira', 'kael', 'liora'].map(actorPosition));
  assert.ok(positionsAfter.some((position, index) =>
    Math.hypot(position.x - positionsBefore[index].x, position.y - positionsBefore[index].y) > 1), 'Персонажи не пошли выполнять план');

  console.log('Checking dungeon departure and return...');
  await advanceHour(500);
  await advanceHour(2600);
  const phasesAtDeparture = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorAttribute(id, 'data-phase')));
  assert.ok(phasesAtDeparture.filter((phase) => phase === 'away').length >= 2, 'Участники похода не покинули карту');
  const dungeonTextAtDeparture = await page.getByTestId('dungeon-panel').textContent();
  assert.ok(dungeonTextAtDeparture?.includes('В подземелье'), 'Экспедиция не перешла в активное состояние');
  assert.ok(dungeonTextAtDeparture?.includes('покинули кибитку'), 'Не создано событие входа в подземелье');

  await advanceHour();
  const dungeonTextAfterEvent = await page.getByTestId('dungeon-panel').textContent();
  assert.ok(
    ['бой', 'проход', 'находк', 'паёк', 'доверие', 'монстр'].some((fragment) => dungeonTextAfterEvent?.toLowerCase().includes(fragment)),
    'Подземелье не создало содержательное событие',
  );
  for (let hour = 0; hour < 6; hour += 1) await advanceHour();
  await page.waitForTimeout(2600);
  const dungeonTextOnReturn = await page.getByTestId('dungeon-panel').textContent();
  assert.ok(dungeonTextOnReturn?.includes('Завершён') || dungeonTextOnReturn?.includes('Отступление'), 'Экспедиция не завершилась');
  assert.ok(dungeonTextOnReturn?.includes('вернул'), 'Нет события возвращения группы');

  console.log('Checking negotiated social scenes...');
  await advanceHour();
  await advanceHour(500);
  const socialText = await page.getByTestId('social-scenes-panel').textContent();
  assert.ok(socialText?.includes('Разговор') || socialText?.includes('Совместная помощь') || socialText?.includes('Попытка примирения'), 'Не создана социальная сцена');
  assert.ok(socialText?.includes('согласие') || socialText?.includes('перенос') || socialText?.includes('отказ'), 'У социальной сцены нет ответа');
  assert.ok(socialText?.includes('Мира') || socialText?.includes('Каэль') || socialText?.includes('Лиора'), 'В сцене не показаны участники');

  console.log('Checking manual save and load...');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const savedTick = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2')).tick);
  await advanceHour();
  const advancedTick = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2')).tick);
  assert.ok(advancedTick > savedTick, 'Автосохранение не обновилось после хода времени');
  await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
  await page.waitForTimeout(250);
  const bodyAfterLoad = await page.textContent('body');
  assert.ok(bodyAfterLoad?.includes('сохранение загружено'), 'Интерфейс не подтвердил загрузку');

  console.log('Checking hero history and veiled model...');
  await page.getByRole('button', { name: 'Открыть историю героя', exact: true }).click();
  await page.getByTestId('hero-history').waitFor();
  assert.ok((await page.getByTestId('hero-history').textContent())?.includes('История'), 'Не открылась история героя');
  await page.getByRole('button', { name: 'Открыть внутреннюю модель и события', exact: true }).click();
  await page.getByTestId('inner-model').waitFor();
  const innerText = await page.getByTestId('inner-model').textContent();
  for (const section of ['Все эмоции', 'Черты личности', 'Потребности', 'Психика', 'Отношения', 'Воспоминания']) {
    assert.ok(innerText?.includes(section), `Не раскрыт раздел: ${section}`);
  }

  console.log('Checking diagnostic export...');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().startsWith('tavernborne-'), 'Неверное имя диагностического файла');

  console.log('Checking new deterministic seed...');
  await page.getByLabel('Seed мира').fill('social-test-777');
  await page.getByRole('button', { name: 'Новый мир', exact: true }).click();
  await page.waitForTimeout(250);
  assert.ok((await page.getByTestId('world-seed').textContent())?.includes('social-test-777'), 'Новый seed не применился');

  await page.getByRole('button', { name: 'Открыть внутреннюю модель и события', exact: true }).click();
  await page.getByRole('button', { name: 'Похвалить', exact: true }).click();
  await page.getByRole('button', { name: 'Показать журнал событий', exact: true }).click();
  await page.getByTestId('journal-panel').waitFor();
  assert.ok((await page.getByTestId('journal-panel').textContent())?.includes('Астер похвалил'), 'Событие не появилось в журнале');
  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);

  console.log('Seeded saves and social scenes browser smoke test passed.');
} catch (error) {
  console.error('Seeded saves and social scenes browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'rts-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
