import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

interface State { email: string; password: string; apiUrl: string; webUrl: string; runId: string; fixtures: Array<{ id: string; slug: string }> }
export function state(): State {
  if (!process.env.PORTFOLIO_E2E_RUN_DIR) throw new Error('Missing isolated E2E run directory');
  return JSON.parse(readFileSync(path.join(process.env.PORTFOLIO_E2E_RUN_DIR, 'state.json'), 'utf8'));
}
export async function login(page: Page) {
  const credentials = state();
  await page.goto('/admin');
  await page.getByLabel('Электронная почта').fill(credentials.email);
  await page.getByLabel('Пароль', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Войти в студию →' }).click();
  await expect(page.getByRole('link', { name: '+ Новый проект' })).toBeVisible();
}
export async function localized(scope: Page | Locator, label: string, ru: string, en: string) {
  const group = scope.getByRole('group', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*\\*)?$`) });
  await group.getByRole('textbox').nth(0).fill(ru);
  await group.getByRole('textbox').nth(1).fill(en);
}
export async function adminRequest(request: APIRequestContext, route: string, method = 'GET', data?: unknown) {
  const session = await request.get('/api/admin/session');
  expect(session.ok()).toBeTruthy();
  const { csrfToken } = await session.json();
  const response = await request.fetch(`/api/admin${route}`, { method, headers: { 'x-csrf-token': csrfToken }, data });
  expect(response.ok(), `${method} ${route}: ${response.status()}`).toBeTruthy();
  return response;
}
export function watchBrowserErrors(page: Page, allowSession401 = false) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const expectedSession = allowSession401 && message.location().url.includes('/api/admin/session') && /401/.test(message.text());
    const missingFavicon = message.location().url.endsWith('/favicon.ico') && /404/.test(message.text());
    if (!expectedSession && !missingFavicon) errors.push(message.text());
  });
  return errors;
}
export async function noOverflow(page: Page) {
  const measured = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
  expect(measured.content, `Horizontal overflow at ${measured.viewport}px`).toBeLessThanOrEqual(measured.viewport + 1);
}
