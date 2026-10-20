import { expect, test, type Page } from '@playwright/test';
import { fixtureContent } from './fixture-content';
import { adminRequest, localized, login, state, watchBrowserErrors } from './helpers';

async function chooseImage(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Выбрать изображение', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Выбрать', exact: true }).first().click();
  await expect(dialog).toHaveCount(0);
}

test('owner creates, uploads, previews and publishes RU+EN, selects home and logs out', async ({ page, context, playwright }, testInfo) => {
  test.setTimeout(240_000);
  const errors = watchBrowserErrors(page, true);
  const run = state();
  const slug = `browser-editor-${run.runId}`;
  const title = { ru: 'Кейс из редактора', en: 'Case from the editor' };
  const anonymous = await playwright.request.newContext({ baseURL: run.webUrl });
  await login(page);
  await page.getByRole('link', { name: '+ Новый проект' }).click();
  await localized(page, 'Название проекта', title.ru, title.en);
  await page.getByLabel('Адрес проекта (slug)').fill(slug);
  await page.getByRole('button', { name: 'Создать черновик →' }).click();
  await expect(page).toHaveURL(/\/admin\/projects\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split('/').pop()!;
  await expect(page.getByRole('heading', { name: title.ru, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Опубликовать RU + EN ↗' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Заполните обе языковые версии' })).toBeVisible();

  // Prepare repetitive metadata through the same authenticated API. The browser owns
  // creation, cover upload, bilingual blocks, three home stages, preview and publication.
  const existing = await (await adminRequest(context.request, `/projects/${id}`)).json();
  const prepared = fixtureContent(title.ru, title.en);
  prepared.cover = null; prepared.blocks = []; prepared.home = { headline: { ru: '', en: '' }, subline: { ru: '', en: '' }, stages: [] };
  await adminRequest(context.request, `/projects/${id}`, 'PATCH', { revision: existing.revision, slug, draft: prepared });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Выбрать изображение', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Выбрать изображение', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Выбрать изображение', exact: true });
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/admin/media') && response.request().method() === 'POST');
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'browser-cover.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR0cAAAAASUVORK5CYII=', 'base64') });
  const mediaResponse = await uploaded;
  expect(mediaResponse.ok()).toBeTruthy();
  const media = await mediaResponse.json();
  await chooseImage(page);
  await localized(page.getByRole('tabpanel'), 'Альтернативный текст', 'Тестовая обложка', 'Test cover');
  expect((await anonymous.get(`/api/media/${media.id}/page`)).status()).toBe(404);

  await page.getByRole('tab', { name: /^Кейс/ }).click();
  await page.getByRole('button', { name: '+ Текст', exact: true }).click();
  await localized(page.getByRole('tabpanel'), 'Заголовок', 'От задачи к решению', 'From challenge to solution');
  await localized(page.getByRole('tabpanel'), 'Текст', 'Подробное описание решения и процесса работы.', 'A detailed account of the solution and design process.');
  await page.getByRole('tab', { name: 'История на главной', exact: true }).click();
  await localized(page.getByRole('tabpanel'), 'Крупный заголовок', 'Интерфейс начинается с человека.', 'An interface starts with a person.');
  await localized(page.getByRole('tabpanel'), 'Подзаголовок', 'Три шага к понятному продукту.', 'Three steps to a clear product.');
  for (let index = 0; index < 3; index++) {
    await page.getByRole('button', { name: '+ Добавить этап', exact: true }).click();
    const stage = page.getByRole('tabpanel').locator('details').nth(index);
    await localized(stage, 'Метка этапа', `Шаг ${index + 1}`, `Step ${index + 1}`);
    await localized(stage, 'Заголовок', `Решение ${index + 1}`, `Solution ${index + 1}`);
    await localized(stage, 'Описание', 'Проверяем задачу и понятность интерфейса.', 'Verify the challenge and clarity of the interface.');
    await stage.getByRole('button', { name: 'Выбрать изображение', exact: true }).click();
    await chooseImage(page);
    await localized(stage, 'Альтернативный текст', `Изображение этапа ${index + 1}`, `Stage ${index + 1} image`);
  }
  await page.getByRole('button', { name: 'Сохранить сейчас' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Все изменения сохранены' })).toBeVisible();
  for (const locale of ['RU', 'EN']) {
    const popupPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: `Превью ${locale} ↗`, exact: true }).click();
    const popup = await popupPromise;
    await expect(popup.getByRole('heading', { level: 1 })).toHaveText(locale === 'RU' ? title.ru : title.en);
    await expect(popup.getByText(`Предпросмотр черновика · ${locale}`)).toBeVisible();
    await popup.close();
  }
  expect((await anonymous.get(`/api/public/projects/${slug}`)).status()).toBe(404);
  expect((await (await anonymous.get('/api/public/routes')).json()).some((row: { slug: string }) => row.slug === slug)).toBe(false);
  expect((await anonymous.get(`/api/admin/projects/${id}/preview`)).status()).toBe(401);
  await page.getByRole('button', { name: 'Опубликовать RU + EN ↗' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Обе языковые версии опубликованы.' })).toBeVisible();
  expect((await anonymous.get(`/api/media/${media.id}/page`)).status()).toBe(200);
  const snapshot = await (await anonymous.get(`/api/public/projects/${slug}`)).json();
  expect(snapshot.content.title).toEqual(title);
  await page.getByRole('tab', { name: 'SEO и адрес' }).click();
  await expect(page.getByLabel('Адрес проекта (slug)')).toBeDisabled();

  await page.getByRole('tab', { name: 'О проекте', exact: true }).click();
  await localized(page.getByRole('tabpanel'), 'Краткое описание', 'Приватный новый черновик.', 'A private new draft.');
  await page.getByRole('button', { name: 'Сохранить сейчас' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Все изменения сохранены' })).toBeVisible();
  expect((await (await anonymous.get(`/api/public/projects/${slug}`)).json()).content.summary).toEqual(snapshot.content.summary);
  await page.getByRole('button', { name: 'Обновить публикацию ↗' }).click();
  await expect.poll(async () => (await (await anonymous.get(`/api/public/projects/${slug}`)).json()).content.summary.en).toBe('A private new draft.');

  await page.getByRole('navigation', { name: 'Разделы студии' }).getByRole('link', { name: 'Главная', exact: true }).click();
  await page.getByLabel('Опубликованный проект').nth(0).selectOption(id);
  await page.getByLabel('Опубликованный проект').nth(1).selectOption(run.fixtures[1]!.id);
  await page.getByRole('button', { name: 'Сохранить главную ↗' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Главная обновлена.' })).toBeVisible();
  await expect.poll(async () => (await (await anonymous.get('/api/public/home')).json()).first.id).toBe(id);
  const publicPage = await context.newPage();
  await publicPage.goto(`/en/projects/${slug}`);
  await expect(publicPage.getByRole('heading', { level: 1 })).toHaveText(title.en);
  await publicPage.screenshot({ path: testInfo.outputPath('published-case-en.png'), fullPage: true });
  await publicPage.close();
  page.once('dialog', dialog => { void dialog.accept(); });
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Войти в студию →' })).toBeVisible();
  expect((await context.request.get('/api/admin/session')).status()).toBe(401);
  expect(errors).toEqual([]);
  await anonymous.dispose();
});
