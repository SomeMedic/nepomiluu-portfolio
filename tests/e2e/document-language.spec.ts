import { expect, test } from '@playwright/test';

test('document language follows server routes and client locale navigation', async ({ page, request }) => {
  for (const [route, language] of [['/ru', 'ru'], ['/en', 'en'], ['/admin', 'ru']] as const) {
    const response = await request.get(route, { headers: { 'x-portfolio-document-language': language === 'en' ? 'ru' : 'en' } });
    expect(response.status()).toBe(200);
    expect(await response.text()).toMatch(new RegExp(`<html\\b[^>]*\\blang="${language}"`));
  }
  await page.goto('/ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.evaluate(() => { document.documentElement.dataset.languageNavigationCheck = 'same-document'; });
  await page.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-language-navigation-check', 'same-document');
  await page.getByRole('link', { name: 'RU', exact: true }).click();
  await expect(page).toHaveURL(/\/ru$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.goBack();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/admin');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
});
