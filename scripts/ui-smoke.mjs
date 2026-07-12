import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const pageErrors = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

try {
  await page.goto('http://127.0.0.1:4173/tavernborne/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Наблюдение за семьёй' }).waitFor();

  const bodyBefore = await page.textContent('body');
  for (const name of ['Астер', 'Мира', 'Каэль', 'Лиора']) {
    assert.ok(bodyBefore?.includes(name), `Не найден персонаж: ${name}`);
  }

  await page.getByRole('button', { name: '+1 час' }).click();
  await page.getByText('Сейчас делает').waitFor();
  await page.getByRole('button', { name: 'Похвалить' }).click();
  await page.getByRole('button', { name: 'Запустить' }).click();
  await page.waitForTimeout(1700);
  await page.getByRole('button', { name: 'Пауза' }).click();

  const bodyAfter = await page.textContent('body');
  assert.ok(bodyAfter?.includes('Последние события'), 'Не найден журнал событий');
  assert.ok(bodyAfter?.includes('Астер похвалил'), 'Похвала не появилась в журнале');
  assert.equal(pageErrors.length, 0, `Ошибки страницы: ${pageErrors.join(' | ')}`);

  await page.screenshot({ path: 'rts-smoke.png', fullPage: true });
  console.log('RTS browser smoke test passed.');
} finally {
  await browser.close();
}
