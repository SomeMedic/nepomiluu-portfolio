const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const output = path.join(__dirname, 'home-recapture');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1, locale: 'ru-RU' });
  const page = await context.newPage();
  const started = Date.now();
  const actions = [];
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    const response = await page.goto('https://fomin-clinic.ru/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    const closeNotice = page.locator('.app-popup__close-btn');
    if (await closeNotice.isVisible()) { await closeNotice.click(); actions.push('Closed the official entrance notice with its close button'); }
    const confirmCity = page.getByRole('button', { name: 'Да, верно', exact: true });
    if (await confirmCity.isVisible()) { await confirmCity.click(); actions.push('Confirmed Moscow with the official city selection button'); }
    console.log(JSON.stringify({ title: await page.title(), status: response?.status(), actions, afterLoadMs: Date.now() - started }));
    for (const [index, delay] of [[0, 1000], [1, 6000], [2, 12000]]) {
      await page.waitForTimeout(delay);
      const state = await page.evaluate(() => {
        const visibleTexts = [...document.querySelectorAll('h1,h2,h3,p,a,button,span')].filter(el => {
          const r = el.getBoundingClientRect();
          return r.width && r.height && r.top < innerHeight && r.bottom > 0 && el.textContent.trim() && el.children.length < 3;
        }).map(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { tag: el.tagName, class: el.className, text: el.textContent.trim().slice(0, 300), x: r.x, y: r.y, width: r.width, height: r.height, opacity: s.opacity, visibility: s.visibility, transform: s.transform }; });
        return { scrollY, readyState: document.readyState, fonts: document.fonts.status, viewport: { width: innerWidth, height: innerHeight }, visibleTexts, animations: document.getAnimations().map(a => ({ state: a.playState, currentTime: a.currentTime, target: a.effect?.target?.className })), bodyExcerpt: document.body.innerText.slice(0, 4000) };
      });
      const file = `inspection-${index}`;
      await fs.writeFile(path.join(output, `${file}.json`), JSON.stringify({ capturedAt: new Date().toISOString(), elapsedMs: Date.now() - started, actions, errors, ...state }, null, 2));
      await page.screenshot({ path: path.join(output, `${file}.png`), fullPage: false });
      console.log(JSON.stringify({ file, elapsedMs: Date.now() - started, texts: state.visibleTexts.filter(e => e.tag === 'H1' || e.tag === 'H2'), animations: state.animations, errors }));
    }
    await fs.writeFile(path.join(output, 'page.html'), await page.content());
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
