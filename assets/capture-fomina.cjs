const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

async function run() {
  const projectRoot = path.resolve(__dirname, '..');
  const captureRoot = path.join(__dirname, 'source-captures');
  const outputRoot = path.join(projectRoot, 'apps/web/public/assets');
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1, locale: 'ru-RU' });
  const captures = [];
  try {
    for (const [slug, url] of [
      ['home', 'https://fomin-clinic.ru/'],
      ['doctors', 'https://fomin-clinic.ru/doctors/'],
      ['service', 'https://fomin-clinic.ru/services/ginekologiya/'],
    ]) {
      const page = await context.newPage();
      let response;
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        const actions = [];
        const entranceNoticeClose = page.locator('.app-popup__close-btn');
        if (await entranceNoticeClose.isVisible()) {
          await entranceNoticeClose.click();
          actions.push('Closed official clinic entrance notice with its close button');
        }
        const confirmCity = page.getByRole('button', { name: 'Да, верно', exact: true });
        if (await confirmCity.isVisible()) {
          await confirmCity.click();
          actions.push('Confirmed Moscow using the official city selection control');
        }
        await page.waitForTimeout(1000);
        const snapshot = {
          sourceUrl: url,
          finalUrl: page.url(),
          capturedAt: new Date().toISOString(),
          title: await page.title(),
          httpStatus: response?.status(),
          viewport: { width: 1600, height: 1050 },
          actions,
          bodyExcerpt: (await page.locator('body').innerText()).slice(0, 18000),
          buttons: await page.locator('button').allTextContents(),
        };
        await fs.writeFile(path.join(captureRoot, `fomina-${slug}.json`), JSON.stringify(snapshot, null, 2));
        await page.screenshot({ path: path.join(captureRoot, `fomina-${slug}.png`), fullPage: false });
        await sharp(path.join(captureRoot, `fomina-${slug}.png`)).webp({ quality: 92 }).toFile(path.join(outputRoot, `fomina-${slug}.webp`));
        captures.push(snapshot);
        console.log(JSON.stringify({ slug, ...snapshot, bodyExcerpt: snapshot.bodyExcerpt.slice(0, 300), buttons: snapshot.buttons.filter(Boolean).slice(0, 20) }));
      } catch (error) {
        console.log(JSON.stringify({ slug, url, error: String(error) }));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  await fs.writeFile(path.join(captureRoot, 'manifest.json'), JSON.stringify(captures, null, 2));
  if (captures.length !== 3) process.exitCode = 1;
}
run().catch(error => { console.error(error); process.exitCode = 1; });
