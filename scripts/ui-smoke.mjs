import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
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

try {
  console.log('Opening realtime RTS page...');
  await page.goto('http://127.0.0.1:4173/tavernborne/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'RTS-наблюдение в реальном времени' }).waitFor();
  await page.getByTestId('rts-map').waitFor();

  const bodyBefore = await page.textContent('body');
  for (const name of ['Астер', 'Мира', 'Каэль', 'Лиора']) {
    assert.ok(bodyBefore?.includes(name), `Не найден персонаж: ${name}`);
  }
  assert.equal(await page.locator('.rts-head').count(), 3, 'Персонажи не отрисованы как фигуры');
  assert.equal(await page.locator('.rts-leg').count(), 6, 'У персонажей не отрисованы ноги');

  const positionsBefore = await Promise.all(['mira', 'kael', 'liora'].map(actorPosition));

  console.log('Advancing one hour and checking movement...');
  await page.getByRole('button', { name: '+1 час', exact: true }).click();
  await page.waitForTimeout(1400);

  const positionsAfter = await Promise.all(['mira', 'kael', 'liora'].map(actorPosition));
  const moved = positionsAfter.some((position, index) =>
    Math.hypot(position.x - positionsBefore[index].x, position.y - positionsBefore[index].y) > 1,
  );
  assert.ok(moved, 'Ни один персонаж не начал двигаться к выбранному действию');

  const phases = await Promise.all(['mira', 'kael', 'liora'].map(async (id) => page.getByTestId(`actor-${id}`).getAttribute('data-phase')));
  assert.ok(phases.some((phase) => phase === 'moving' || phase === 'acting' || phase === 'interacting'), 'RTS-фазы действий не активировались');

  console.log('Waiting for a visible action animation...');
  await page.waitForTimeout(3600);
  const actionProps = await page.locator('.rts-prop').count();
  assert.ok(actionProps > 0, 'Не появилась ни одна визуальная принадлежность действия');

  console.log('Applying event and running realtime loop...');
  await page.getByRole('button', { name: 'Похвалить', exact: true }).click();
  await page.getByRole('button', { name: 'Запустить', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();

  const bodyAfter = await page.textContent('body');
  assert.ok(bodyAfter?.includes('Журнал семьи'), 'Не найден журнал событий');
  assert.ok(bodyAfter?.includes('Астер похвалил'), 'Похвала не появилась в журнале');
  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);

  console.log('Realtime RTS browser smoke test passed.');
} catch (error) {
  console.error('Realtime RTS browser smoke test failed:', error);
  throw error;
} finally {
  await page.screenshot({ path: 'rts-smoke.png', fullPage: true }).catch(() => undefined);
  await browser.close();
}
