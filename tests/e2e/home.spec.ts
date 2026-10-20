import { expect, test } from '@playwright/test';
import { noOverflow, state, watchBrowserErrors } from './helpers';

test('RU and EN are server rendered, locale links and case routes work', async ({ page, request }) => {
  const errors = watchBrowserErrors(page);
  const home = await (await request.get('/api/public/home')).json();
  for (const locale of ['ru', 'en'] as const) {
    const response = await request.get(`/${locale}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('id="main-content"');
    expect(html).toContain(locale === 'ru' ? 'Непомилуева' : 'Nepomilueva');
    expect(html).toContain(home.first.content.home.headline[locale]);
  }
  await page.goto('/ru');
  await expect(page.locator('#hero-title')).toContainText('Непомилуева');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByText('Runtime Error', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('#hero-title')).toContainText('Nepomilueva');
  await expect(page.getByRole('link', { name: 'EN', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goto(`/en/projects/${home.second.slug}`);
  await expect(page.locator('h1')).toContainText(home.second.content.title.en);
  await page.getByRole('link', { name: 'RU', exact: true }).click();
  await expect(page).toHaveURL(`/ru/projects/${home.second.slug}`);
  await expect(page.locator('h1')).toContainText(home.second.content.title.ru);
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 768, 1024, 1440, 1586, 1920]) {
  test(`reduced motion preserves all content and native anchors at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = watchBrowserErrors(page);
    await page.goto('/ru');
    await expect(page.locator('#hero-title')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await noOverflow(page);
    await page.locator('a[href="#projects"]').first().click();
    await expect(page).toHaveURL(/#projects$/);
    await expect(page.locator('#projects')).toBeInViewport();
    const stageNav = page.getByRole('navigation', { name: 'Этапы работы над проектом', exact: true });
    await expect(stageNav.getByRole('link')).toHaveCount(3);
    await stageNav.getByRole('link').nth(2).click();
    await expect(page).toHaveURL(/#clypse-stage-2$/);
    await expect(page.locator('#clypse-stage-2')).toBeInViewport();
    for (const id of ['clypse-stage-0', 'clypse-stage-1', 'clypse-stage-2', 'fomina-stage-0', 'fomina-stage-1', 'fomina-stage-2', 'process-stage-0', 'process-stage-1', 'process-stage-2']) {
      const item = page.locator(`#${id}`);
      await expect(item).toBeVisible();
      await expect(item).not.toHaveAttribute('aria-hidden', 'true');
    }
    await page.locator('a[href="#contacts"]').last().click();
    await expect(page.locator('#contacts')).toBeInViewport();
    await noOverflow(page);
    if (width === 390 || width === 1586) {
      await page.goto('/ru');
      await page.screenshot({ path: testInfo.outputPath(`ru-reduced-${width}.png`), fullPage: true });
    }
    await page.goto('/en');
    await expect(page.locator('#hero-title')).toContainText('Nepomilueva');
    await page.evaluate(() => document.fonts.ready);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
}

test('normal motion stage controls change the visible stage and history remains usable', async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await page.goto('/ru');
  await expect(page.locator('#hero-title')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const nav = page.getByRole('navigation', { name: 'Этапы работы над проектом', exact: true });
  await nav.getByRole('link').nth(2).click();
  await expect(page).toHaveURL(/#clypse-stage-2$/);
  await expect(page.locator('#clypse-stage-2')).toBeInViewport();
  await expect(page.locator('#clypse-stage-2')).not.toHaveAttribute('aria-hidden', 'true');
  const process = page.getByRole('navigation', { name: 'Этапы работы', exact: true });
  await process.getByRole('link').nth(1).click();
  await expect(page).toHaveURL(/#process-stage-1$/);
  await expect(page.locator('#process-stage-1')).toBeInViewport();
  await expect(page.locator('#process-stage-1')).not.toHaveAttribute('aria-hidden', 'true');
  await page.goto(`/ru/projects/${state().fixtures[1]!.slug}`);
  await expect(page.locator('h1')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/ru#process-stage-1$/);
  await expect(page.locator('#process-stage-1')).toBeInViewport();
  await expect(page.locator('#process-stage-1')).not.toHaveAttribute('aria-hidden', 'true');
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('a short desktop viewport keeps every stage readable in document flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto('/ru');
  await expect(page.locator('#hero-title')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const scene of ['clypse', 'fomina', 'process']) {
    const section = page.locator(`[data-scene="${scene}"]`);
    await expect(section).not.toHaveAttribute('data-enhanced', 'true');
    for (let index = 0; index < 3; index++) {
      await expect(section.locator(`[data-stage="${index}"]`)).toBeVisible();
      await expect(section.locator(`[data-stage="${index}"]`)).not.toHaveAttribute('aria-hidden', 'true');
    }
  }
  await noOverflow(page);
});
