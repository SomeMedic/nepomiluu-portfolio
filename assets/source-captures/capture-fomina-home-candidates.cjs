const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const output = path.join(__dirname, 'home-recapture');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1, locale: 'ru-RU' });
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
    ]) {
      if (await locator.first().isVisible()) { await locator.first().click(); actions.push(description); }
    }
    await page.waitForTimeout(6000);
    for (const [name, scroll] of [['first-screen', false], ['content-screen', true]]) {
      if (scroll) { await page.locator('.intro-block-banners .swiper-slide-active').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(4000); }
      const state = await page.evaluate(() => ({
        scrollY, readyState: document.readyState, fonts: document.fonts.status,
        viewport: { width: innerWidth, height: innerHeight },
        heading: document.querySelector('h1')?.textContent.trim(),
        visibleHeadings: [...document.querySelectorAll('h1,h2,h3')].map(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { text: el.textContent.trim(), x: r.x, y: r.y, width: r.width, height: r.height, opacity: s.opacity, visibility: s.visibility }; }).filter(e => e.x < innerWidth && e.x + e.width > 0 && e.y < innerHeight && e.y + e.height > 0 && e.visibility === 'visible'),
        activeImages: [...document.querySelectorAll('.intro-block img,.intro-block-banners .swiper-slide-active img')].map(img => ({ src: img.currentSrc, loaded: img.complete && img.naturalWidth > 0, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })),
      }));
      const snapshot = { sourceUrl: 'https://fomin-clinic.ru/', finalUrl: page.url(), capturedAt: new Date().toISOString(), title: await page.title(), httpStatus: response?.status(), actions: [...actions], ...state };
      await fs.writeFile(path.join(output, `${name}.json`), JSON.stringify(snapshot, null, 2));
      await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false });
      console.log(JSON.stringify({ name, ...snapshot }));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
