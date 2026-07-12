import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
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

const advanceHour = async (wait = 80) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click();
  await page.waitForTimeout(wait);
};

try {
  console.log('Opening deployed GitHub Pages simulation...');
  await page.goto('https://terratectra.github.io/tavernborne/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await page.getByTestId('rts-map').waitFor();
  await page.getByTestId('day-plan').waitFor();
  await page.getByTestId('dungeon-panel').waitFor();

  const bodyBefore = await page.textContent('body');
  for (const name of ['Астер', 'Мира', 'Каэль', 'Лиора']) {
    assert.ok(bodyBefore?.includes(name), `Не найден персонаж: ${name}`);
  }
  assert.ok(bodyBefore?.includes('Общий завтрак'), 'Не создан общий семейный распорядок');
  assert.ok(bodyBefore?.includes('Экспедиция на 1-й этаж'), 'Не создан план первой экспедиции');
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
  const moved = positionsAfter.some((position, index) =>
    Math.hypot(position.x - positionsBefore[index].x, position.y - positionsBefore[index].y) > 1,
  );
  assert.ok(moved, 'Персонажи не пошли выполнять план');

  console.log('Advancing to dungeon departure...');
  await advanceHour(500);
  await advanceHour(2600);

  const phasesAtDeparture = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorAttribute(id, 'data-phase')));
  assert.ok(phasesAtDeparture.filter((phase) => phase === 'away').length >= 2, 'Участники похода не покинули карту');

  const dungeonTextAtDeparture = await page.getByTestId('dungeon-panel').textContent();
  assert.ok(dungeonTextAtDeparture?.includes('В подземелье'), 'Экспедиция не перешла в активное состояние');
  assert.ok(dungeonTextAtDeparture?.includes('покинули кибитку'), 'Не создано событие входа в подземелье');

  const planAtDeparture = await page.getByTestId('day-plan').textContent();
  assert.ok(
    planAtDeparture?.includes('Собрать снаряжение') && planAtDeparture?.includes('выполнено'),
    'Подготовка не была завершена перед походом',
  );
  assert.ok(
    planAtDeparture?.includes('Поход на 1-й этаж') && planAtDeparture?.includes('сейчас'),
    'Блок похода не стал активным',
  );

  console.log('Checking living dungeon event...');
  await advanceHour();
  const dungeonTextAfterEvent = await page.getByTestId('dungeon-panel').textContent();
  assert.ok(
    ['бой', 'проход', 'находк', 'паёк', 'доверие', 'монстр'].some((fragment) => dungeonTextAfterEvent?.toLowerCase().includes(fragment)),
    'Подземелье не создало содержательное событие',
  );

  console.log('Advancing expedition to its planned return...');
  for (let hour = 0; hour < 6; hour += 1) {
    await advanceHour();
  }
  await page.waitForTimeout(2600);

  const dungeonTextOnReturn = await page.getByTestId('dungeon-panel').textContent();
  assert.ok(
    dungeonTextOnReturn?.includes('Завершён') || dungeonTextOnReturn?.includes('Отступление'),
    'Экспедиция не завершилась или не отступила',
  );
  assert.ok(dungeonTextOnReturn?.includes('вернул'), 'Нет события возвращения группы');

  const phasesAfterReturn = await Promise.all(['mira', 'kael'].map((id) => actorAttribute(id, 'data-phase')));
  assert.ok(phasesAfterReturn.every((phase) => phase !== 'away'), 'Герои не вернулись на карту кибитки');

  const planAfterReturn = await page.getByTestId('day-plan').textContent();
  assert.ok(
    planAfterReturn?.includes('Поход на 1-й этаж') && planAfterReturn?.includes('выполнено'),
    'Завершённый поход не закрыт в плане дня',
  );

  console.log('Opening veiled personality model...');
  await page.getByRole('button', { name: 'Открыть внутреннюю модель и события', exact: true }).click();
  await page.getByTestId('inner-model').waitFor();
  const innerText = await page.getByTestId('inner-model').textContent();
  for (const section of ['Все эмоции', 'Черты личности', 'Потребности', 'Психика', 'Отношения', 'Воспоминания']) {
    assert.ok(innerText?.includes(section), `Не раскрыт раздел: ${section}`);
  }

  console.log('Applying event and checking hidden journal...');
  await page.getByRole('button', { name: 'Похвалить', exact: true }).click();
  await page.getByRole('button', { name: 'Показать журнал событий', exact: true }).click();
  await page.getByTestId('journal-panel').waitFor();
  const journalText = await page.getByTestId('journal-panel').textContent();
  assert.ok(journalText?.includes('Астер похвалил'), 'Событие не появилось в журнале');
  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);

  console.log('Deployed GitHub Pages simulation passed the full browser smoke test.');
} catch (error) {
  console.error('Deployed GitHub Pages smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'rts-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
