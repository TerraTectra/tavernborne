import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const testUrl = process.env.TEST_URL ?? 'http://127.0.0.1:4173/tavernborne/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 }, acceptDownloads: true });
const pageErrors = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

const actorAttribute = (heroId, attribute) =>
  page.getByTestId(`actor-${heroId}`).getAttribute(attribute);

const advanceHour = async (wait = 120) => {
  await page.getByRole('button', { name: '+1 час', exact: true }).click();
  await page.waitForTimeout(wait);
};

try {
  console.log(`Opening living RTS simulation at ${testUrl}...`);
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Живая кибитка' }).waitFor();
  await page.getByTestId('rts-map').waitFor();
  await page.getByTestId('day-plan').waitFor();
  await page.getByTestId('dungeon-panel').waitFor();
  await page.getByTestId('save-panel').waitFor();
  await page.getByTestId('social-scenes-panel').waitFor();
  await page.getByTestId('leadership-panel').waitFor({ timeout: 5000 });

  const bodyBefore = await page.textContent('body');
  for (const name of ['Астер', 'Мира', 'Каэль', 'Лиора']) {
    assert.ok(bodyBefore?.includes(name), `Не найден персонаж: ${name}`);
  }
  assert.ok(bodyBefore?.includes('Общий завтрак'), 'Не создан общий распорядок');
  assert.ok(bodyBefore?.includes('seed: aster-family-001'), 'Не отображается seed');
  assert.ok(bodyBefore?.includes('лидер семьи'), 'На старте не появился лидер семьи');
  assert.ok(!bodyBefore?.includes('Черты личности'), 'Внутренняя модель видна без открытия');
  assert.equal(await page.locator('.rts-head').count(), 3, 'Не отрисованы фигуры героев');

  console.log('Checking leadership model...');
  await page.getByTestId('leadership-panel').getByRole('button').click();
  await page.getByTestId('leadership-details').waitFor();
  const leadershipText = await page.getByTestId('leadership-details').textContent();
  for (const section of ['Состояние лидера', 'Ответственность', 'Давление', 'Лояльность лидеру', 'Последние события власти']) {
    assert.ok(leadershipText?.includes(section), `Не показан раздел лидерства: ${section}`);
  }

  await page.getByRole('button', { name: 'x1', exact: true }).click();
  await page.getByRole('button', { name: 'x2', exact: true }).click();

  console.log('Checking synchronized breakfast...');
  await advanceHour(1700);
  const breakfastActions = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorAttribute(id, 'data-action')));
  assert.deepEqual(breakfastActions, ['eat', 'eat', 'eat'], 'Семья не собралась на завтрак');
  assert.equal(await page.locator('.rts-bowl').count(), 3, 'Не показана совместная еда');

  console.log('Checking visual expedition council: gathering...');
  await advanceHour(2200);
  await page.getByTestId('visual-scene-panel').waitFor({ timeout: 5000 });
  assert.ok((await page.getByTestId('visual-scene-phase').textContent())?.includes('Сбор у общего стола'), 'Совет не начал сбор у стола');
  const sceneActors = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorAttribute(id, 'data-scene')));
  assert.equal(sceneActors.filter(Boolean).length, 3, 'Не все члены семьи включены в визуальную сцену');

  console.log('Checking leader briefing...');
  await advanceHour(800);
  assert.ok((await page.getByTestId('visual-scene-phase').textContent())?.includes('Объявление цели'), 'Лидер не объявил цель похода');
  assert.ok(await page.locator('[data-testid^="actor-bubble-"]').count() >= 1, 'Речь лидера не показана над фигурой');

  console.log('Checking role assignment and visible responses...');
  await advanceHour(900);
  assert.ok((await page.getByTestId('visual-scene-phase').textContent())?.includes('Распределение ролей'), 'Роли не распределяются визуально');
  const roleText = await page.getByTestId('visual-scene-roles').textContent();
  assert.ok(roleText?.includes('лидер отряда'), 'Не показан лидер отряда');
  assert.ok(['передний боец', 'разведчик', 'поддержка'].some((role) => roleText?.includes(role)), 'Не показана роль второго участника');
  assert.ok(await page.locator('[data-testid^="actor-role-"]').count() >= 2, 'Роли не отображаются над персонажами');

  console.log('Checking physical equipment collection...');
  await advanceHour(2600);
  assert.ok((await page.getByTestId('visual-scene-phase').textContent())?.includes('Получение снаряжения'), 'Нет фазы получения снаряжения');
  assert.ok(await page.locator('.rts-backpack').count() >= 2, 'Участники не получили рюкзаки');
  const equipmentX = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorAttribute(id, 'data-x')));
  assert.ok(equipmentX.filter((value) => Number(value) > 68).length >= 2, 'Группа не подошла к месту снаряжения');

  console.log('Checking formation at exit...');
  await advanceHour(2600);
  assert.ok((await page.getByTestId('visual-scene-phase').textContent())?.includes('Построение у выхода'), 'Группа не построилась у выхода');
  const departureY = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorAttribute(id, 'data-y')));
  assert.ok(departureY.filter((value) => Number(value) > 75).length >= 2, 'Участники физически не подошли к выходу');
  assert.ok(await page.locator('.rts-sword').count() >= 2, 'Перед выходом не показано оружие');

  console.log('Checking departure only after the visual council...');
  await advanceHour(1400);
  const phasesAtDeparture = await Promise.all(['mira', 'kael', 'liora'].map((id) => actorAttribute(id, 'data-phase')));
  assert.ok(phasesAtDeparture.filter((phase) => phase === 'away').length >= 2, 'Группа не покинула карту после совета');
  assert.ok((await page.getByTestId('dungeon-panel').textContent())?.includes('В подземелье'), 'Поход не активен');
  assert.equal(await page.getByTestId('visual-scene-panel').count(), 0, 'Завершённый совет остался активным');

  console.log('Checking dungeon cycle...');
  await advanceHour();
  const dungeonEvent = (await page.getByTestId('dungeon-panel').textContent())?.toLowerCase();
  assert.ok(['бой', 'проход', 'находк', 'паёк', 'доверие', 'монстр'].some((part) => dungeonEvent?.includes(part)), 'Нет события подземелья');
  for (let hour = 0; hour < 6; hour += 1) await advanceHour();
  await page.waitForTimeout(1800);
  const returned = await page.getByTestId('dungeon-panel').textContent();
  assert.ok(returned?.includes('Завершён') || returned?.includes('Отступление'), 'Поход не завершился');

  console.log('Checking negotiated social scene...');
  await advanceHour();
  await advanceHour(500);
  const socialText = await page.getByTestId('social-scenes-panel').textContent();
  assert.ok(socialText?.includes('Разговор') || socialText?.includes('Совместная помощь') || socialText?.includes('Попытка примирения'), 'Социальная сцена не создана');
  assert.ok(socialText?.includes('согласие') || socialText?.includes('перенос') || socialText?.includes('отказ'), 'Нет ответа на предложение');

  console.log('Checking save, visual scene history, leadership persistence and load...');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2')));
  assert.ok(saved.leadership?.familyLeaderId, 'Лидерство не попало в сохранение');
  assert.ok(saved.leadership?.groups?.length >= 1, 'Группы лидерства не сохраняются');
  assert.ok(saved.visualScenes?.scenes?.length >= 1, 'Визуальные сцены не попали в сохранение');
  assert.ok(Object.keys(saved.visualScenes.scenes[0].roles ?? {}).length >= 2, 'Роли совета не сохраняются');
  assert.equal(saved.visualScenes.scenes[0].status, 'resolved', 'Совет не завершён в сохранении');
  const savedTick = saved.tick;
  await advanceHour();
  await page.waitForFunction(
    ({ key, previous }) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw).tick > previous : false;
    },
    { key: 'tavernborne.world.v2', previous: savedTick },
  );
  const latestTick = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2')).tick);
  await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
  await page.waitForTimeout(100);
  assert.ok((await page.getByTestId('world-seed').textContent())?.includes('aster-family-001'), 'Загружен неверный мир');
  const tickAfterLoad = await page.evaluate(() => JSON.parse(window.localStorage.getItem('tavernborne.world.v2')).tick);
  assert.equal(tickAfterLoad, latestTick, 'Загрузка повредила сохранённое состояние');

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
  await page.getByLabel('Seed мира').fill('visual-life-test-777');
  await page.getByRole('button', { name: 'Новый мир', exact: true }).click();
  await page.waitForTimeout(900);
  assert.ok((await page.getByTestId('world-seed').textContent())?.includes('visual-life-test-777'), 'Seed не применился');
  assert.ok((await page.getByTestId('leadership-panel').textContent())?.includes('лидер семьи'), 'В новом мире не назначен лидер');

  await page.getByRole('button', { name: 'Открыть внутреннюю модель и события', exact: true }).click();
  await page.getByRole('button', { name: 'Похвалить', exact: true }).click();
  await page.getByRole('button', { name: 'Показать журнал событий', exact: true }).click();
  await page.getByTestId('journal-panel').waitFor();
  assert.ok((await page.getByTestId('journal-panel').textContent())?.includes('Астер похвалил'), 'Событие не попало в журнал');
  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);

  console.log('Visual action scenes, leadership and living RTS browser smoke test passed.');
} catch (error) {
  console.error('Visual action scene browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'rts-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
