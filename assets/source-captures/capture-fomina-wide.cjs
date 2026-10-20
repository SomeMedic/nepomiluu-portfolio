const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const output = path.join(__dirname, 'home-recapture');
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 622 }, deviceScaleFactor: 1, locale: 'ru-RU' });
  const actions = [];
  try {
    const response = await page.goto('https://fomin-clinic.ru/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    for (const [locator, description] of [
      [page.locator('.app-popup__close-btn'), 'Closed the official entrance notice with its close button'],
      [page.getByRole('button', { name: 'Да, верно', exact: true }), 'Confirmed Moscow with the official city selection button'],
      [page.locator('.warning-msg.open .js-warning-msg-agree'), 'Closed the pink promotion bar using its official close control'],
      [page.locator('.the-cookie__btn'), 'Dismissed cookie notice with its official button'],
    ]) if (await locator.first().isVisible()) { await locator.first().click(); actions.push(description); }
    await page.waitForTimeout(6000);
    for (const [width, height] of [[1600, 622], [1920, 748]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(3500);
      const state = await page.evaluate(() => {
        const heading = document.querySelector('.intro-block__title');
        const rect = heading.getBoundingClientRect();
        const styles = getComputedStyle(heading);
        return { scrollY, readyState: document.readyState, fonts: document.fonts.status, viewport: { width: innerWidth, height: innerHeight }, heading: { text: heading.textContent.trim(), x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, fullyVisible: rect.y >= 0 && rect.bottom <= innerHeight, opacity: styles.opacity, visibility: styles.visibility }, image: { loaded: document.querySelector('.intro-block img').complete, source: document.querySelector('.intro-block img').currentSrc }, visibleModal: !![...document.querySelectorAll('.app-popup')].find(el => getComputedStyle(el).visibility === 'visible' && el.getBoundingClientRect().width > 0) };
      });
      const snapshot = { sourceUrl: 'https://fomin-clinic.ru/', finalUrl: page.url(), capturedAt: new Date().toISOString(), title: await page.title(), httpStatus: response?.status(), deviceScaleFactor: 1, locale: 'ru-RU', actions: [...actions], ...state };
      const file = `first-screen-${width}x${height}`;
      await fs.writeFile(path.join(output, `${file}.json`), JSON.stringify(snapshot, null, 2));
      await page.screenshot({ path: path.join(output, `${file}.png`), fullPage: false });
      console.log(JSON.stringify({ file, ...snapshot }));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
