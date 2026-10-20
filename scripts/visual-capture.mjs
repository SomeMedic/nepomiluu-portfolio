import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const selectors = {
  hero: 'section:has([data-hero-title])',
  clypse: '[data-scene="clypse"]',
  fomina: '[data-scene="fomina"]',
  logic: '[data-scene="logic"]',
  experience: '[data-experience]',
  process: '[data-scene="process"]',
  footer: '[data-home-footer]',
};
const help = `Capture the existing local portfolio; never starts or stops services.
Usage: node scripts/visual-capture.mjs [options]
  --section hero|clypse|fomina|logic|experience|process|footer|all (default: all)
  --width 1586 --height 992  CSS viewport pixels; device scale factor is 1
  --locale ru|en            (default: ru)
  --motion reduce|normal   (default: reduce)
  --out <directory>        (default: output/playwright/visual-capture-<timestamp>)
  --help
Uses http://127.0.0.1:3000/<locale>. Optional PLAYWRIGHT_CHROMIUM_EXECUTABLE.
`;

function options(args) {
  const values = { section: 'all', width: 1586, height: 992, locale: 'ru', motion: 'reduce', out: `output/playwright/visual-capture-${new Date().toISOString().replace(/[:.]/g, '-')}` };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' && args.length === 1) return null;
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !Object.hasOwn(values, key) || seen.has(key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid option: ${args[i]}. Use --help.`);
    seen.add(key);
    values[key] = args[++i];
  }
  for (const key of ['width', 'height']) {
    values[key] = Number(values[key]);
    if (!Number.isInteger(values[key]) || values[key] < 240 || values[key] > 7680) throw new Error(`--${key} must be an integer between 240 and 7680.`);
  }
  if (![...Object.keys(selectors), 'all'].includes(values.section)) throw new Error('Invalid --section. Use --help.');
  if (!['ru', 'en'].includes(values.locale)) throw new Error('--locale must be ru or en.');
  if (!['reduce', 'normal'].includes(values.motion)) throw new Error('--motion must be reduce or normal.');
  values.out = path.resolve(values.out);
  return values;
}

function browserExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    if (!existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)) throw new Error('PLAYWRIGHT_CHROMIUM_EXECUTABLE does not exist.');
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  }
  return ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
}

async function settle(page, selector) {
  // Read geometry and presentation until scrolling, entrance and scrub animations settle.
  // Do not disable animations or change styles: this captures the app's actual state.
  let previous = '';
  let stable = 0;
  for (let attempt = 0; attempt < 40; attempt++) {
    const next = await page.locator(selector).evaluate(section => {
      const round = n => Math.round(n * 10) / 10;
      return JSON.stringify([round(scrollY), ...[section, ...section.querySelectorAll('h1,h2,h3,[data-stage],[data-logic-part],[data-footer-reveal],img')].map(el => {
        const r = el.getBoundingClientRect();
        const css = getComputedStyle(el);
        return [round(r.x), round(r.y), round(r.width), round(r.height), css.opacity, css.transform];
      })]);
    });
    stable = next === previous ? stable + 1 : 0;
    if (stable >= 4) return true;
    previous = next;
    await page.waitForTimeout(125);
  }
  return false;
}

async function visibleImages(page, selector) {
  return page.locator(selector).evaluate(async section => {
    const visible = [...section.querySelectorAll('img')].filter(image => {
      const r = image.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && getComputedStyle(image).visibility !== 'hidden';
    });
    await Promise.race([
      Promise.all(visible.map(async image => {
        if (!image.complete) await new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); });
        if (image.naturalWidth) await image.decode().catch(() => {});
      })),
      new Promise(resolve => setTimeout(resolve, 8000)),
    ]);
    return visible.filter(image => !image.complete || !image.naturalWidth).map(image => image.currentSrc || image.src);
  });
}

async function position(page, name, selector, motion) {
  if (name === 'hero') {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    return { method: 'scroll', requestedTop: 0 };
  }
  if (motion === 'normal' && ['clypse', 'fomina', 'process'].includes(name)) {
    const href = `#${name}-stage-1`;
    const link = page.locator(`${selector} a[href="${href}"]`);
    // Enter the scene first, so lazy content and its responsive pin rebuild have
    // finished before the click chooses a scroll destination.
    await link.scrollIntoViewIfNeeded({ timeout: 15000 });
    await visibleImages(page, selector);
    await settle(page, selector);
    // A genuine browser click lets the existing application resolve pinned scenes.
    await link.click({ timeout: 15000 });
    await page.waitForTimeout(500);
    let clicks = 1;
    if (new URL(page.url()).hash !== href) {
      // A focus-induced pin refresh can move the link between pointer down/up.
      // Retry once with the now-focused, settled link; never force a DOM click.
      await settle(page, selector);
      await link.click({ timeout: 15000 });
      clicks++;
      await page.waitForTimeout(500);
    }
    let scrollFallback = null;
    if (new URL(page.url()).hash !== href) {
      // The capture still needs a controlled stage when native activation fails.
      // Use ordinary browser scrolling, not GSAP state or a fabricated hash.
      const requestedTop = await page.locator(selector).evaluate((section, id) => {
        const spacer = section.parentElement?.classList.contains('pin-spacer') ? section.parentElement : null;
        if (section.dataset.enhanced === 'true' && spacer) {
          return scrollY + spacer.getBoundingClientRect().top + Math.max(0, spacer.getBoundingClientRect().height - section.getBoundingClientRect().height) / 2;
        }
        return scrollY + document.getElementById(id).getBoundingClientRect().top;
      }, href.slice(1));
      await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), requestedTop);
      scrollFallback = { requestedTop, reason: 'Two real link clicks did not change the URL hash.' };
    }
    await page.waitForFunction(({ selector, href, fallback }) => {
      const section = document.querySelector(selector);
      return (location.hash === href || fallback) && (section.dataset.enhanced !== 'true' || section.dataset.current === '1');
    }, { selector, href, fallback: !!scrollFallback }, { timeout: 15000 }).catch(async () => {
      const actual = await page.locator(selector).evaluate(section => ({ hash: location.hash, enhanced: section.dataset.enhanced, currentStage: section.dataset.current, scrollY }));
      throw new Error(`Stage link did not reach ${href}: ${JSON.stringify(actual)}`);
    });
    return { method: 'anchor-click', href, requestedStage: 1, clicks, scrollFallback };
  }
  const requestedTop = await page.locator(selector).evaluate((section, finalStage) => {
    // At scroll zero, pin-spacer marks the scene's actual document start.
    const spacer = section.parentElement?.classList.contains('pin-spacer') ? section.parentElement : null;
    const start = scrollY + (spacer || section).getBoundingClientRect().top;
    const pinDistance = spacer ? Math.max(0, spacer.getBoundingClientRect().height - section.getBoundingClientRect().height) : 0;
    return start + (finalStage ? pinDistance * 0.85 : 0);
  }, motion === 'normal' && name === 'logic');
  await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), requestedTop);
  return { method: 'scroll', requestedTop, pinnedFinalStage: motion === 'normal' && name === 'logic' };
}

async function metrics(page, selector) {
  return page.locator(selector).evaluate(section => {
    const round = n => Math.round(n * 100) / 100;
    const rect = el => {
      const r = el.getBoundingClientRect();
      return { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height), documentX: round(r.x + scrollX), documentY: round(r.y + scrollY) };
    };
    const describe = el => {
      const css = getComputedStyle(el);
      return { tag: el.tagName.toLowerCase(), id: el.id || null, text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 500), rect: rect(el), fontFamily: css.fontFamily, fontSize: css.fontSize, fontWeight: css.fontWeight, fontStyle: css.fontStyle, lineHeight: css.lineHeight, letterSpacing: css.letterSpacing, color: css.color, backgroundColor: css.backgroundColor, opacity: css.opacity, visibility: css.visibility, display: css.display, transform: css.transform };
    };
    const root = getComputedStyle(document.documentElement);
    return {
      url: location.href,
      title: document.title,
      language: document.documentElement.lang,
      viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
      scroll: { x: round(scrollX), y: round(scrollY), maxY: document.documentElement.scrollHeight - innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth) },
      motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'normal',
      fonts: { status: document.fonts.status, faces: [...document.fonts].map(face => ({ family: face.family, weight: face.weight, style: face.style, status: face.status })) },
      colors: Object.fromEntries(['--paper', '--sand', '--ink', '--muted', '--accent', '--accent-dark'].map(name => [name, root.getPropertyValue(name).trim()])),
      section: { ...describe(section), enhanced: section.dataset.enhanced || null, currentStage: section.dataset.current || null },
      typography: [...section.querySelectorAll('h1,h1>span,h2,h2>span,h2>em,h3,p,nav a')].slice(0, 65).map(describe),
      stages: [...section.querySelectorAll('[data-stage],[data-logic-part]')].map(el => ({ ...describe(el), stage: el.dataset.stage ?? el.dataset.logicPart, active: el.dataset.active || null, ariaHidden: el.getAttribute('aria-hidden') })),
      links: [...section.querySelectorAll('a')].map(el => ({ text: el.textContent.trim().replace(/\s+/g, ' '), href: el.getAttribute('href'), current: el.getAttribute('aria-current'), rect: rect(el) })),
      images: [...section.querySelectorAll('img')].map(el => ({ src: el.currentSrc || el.src, alt: el.alt, complete: el.complete, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, rect: rect(el), objectFit: getComputedStyle(el).objectFit })),
    };
  });
}

async function capture(browser, config, name) {
  const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: 1, locale: config.locale === 'ru' ? 'ru-RU' : 'en-US', reducedMotion: config.motion === 'reduce' ? 'reduce' : 'no-preference', colorScheme: 'light' });
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  const record = (type, detail) => errors.push({ type, ...detail });
  page.on('pageerror', error => record('pageerror', { message: error.message }));
  page.on('console', message => { if (message.type() === 'error') record('console', { message: message.text(), location: message.location() }); });
  page.on('requestfailed', request => record('requestfailed', { url: request.url(), message: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) record('http', { url: response.url(), status: response.status() }); });
  const result = { section: name, status: 'failed', errors, warnings };
  try {
    const response = await page.goto(`http://127.0.0.1:3000/${config.locale}`, { waitUntil: 'load', timeout: 60000 });
    if (!response?.ok()) throw new Error(`Page returned HTTP ${response?.status() ?? 'no response'}.`);
    const selector = selectors[name];
    await page.locator(selector).waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    // Allow font-triggered responsive scene rebuilding and the initial entrance.
    await page.waitForTimeout(1000);
    result.position = await position(page, name, selector, config.motion);
    if (result.position.scrollFallback) warnings.push('Real stage-link clicks did not change the URL hash; captured the second stage using ordinary browser scrolling. Navigation is not verified.');
    let missingImages = await visibleImages(page, selector);
    let stable = await settle(page, selector);
    // Lazy image loads can rebuild earlier pin spacers after the first scroll.
    // Re-measure the real section instead of capturing its old document offset.
    if (result.position.method === 'scroll' && name !== 'hero') {
      const adjustments = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        const next = await position(page, name, selector, config.motion);
        adjustments.push(result.position.requestedTop);
        const changed = Math.abs(next.requestedTop - result.position.requestedTop) > 2;
        result.position = { ...next, previousTargets: adjustments };
        missingImages = await visibleImages(page, selector);
        stable = await settle(page, selector);
        if (!changed) break;
      }
    }
    if (missingImages.length) record('image', { urls: missingImages, message: 'Visible image did not load.' });
    if (!stable) warnings.push('Presentation did not stabilize within five seconds.');
    const measured = await metrics(page, selector);
    if (measured.section.rect.y >= config.height || measured.section.rect.y + measured.section.rect.height <= 0) throw new Error('Requested section is outside the viewport after positioning.');
    if (name === 'hero' && measured.scroll.y !== 0) throw new Error('Hero must be captured at scroll zero.');
    if (result.position.method === 'anchor-click' && measured.section.enhanced === 'true' && measured.section.currentStage !== '1') throw new Error('Requested second stage is not active after the anchor click.');
    if (measured.document.horizontalOverflow > 1) warnings.push(`Horizontal document overflow: ${measured.document.horizontalOverflow}px.`);
    if (Math.abs(measured.scroll.y - result.position.requestedTop) > 2 && result.position.method === 'scroll') warnings.push('Scroll target was clamped or adjusted by the application; see actual scroll and geometry.');
    const png = await page.screenshot({ fullPage: false, type: 'png', scale: 'css', caret: 'hide' });
    const dimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    if (dimensions.width !== config.width || dimensions.height !== config.height) throw new Error('Screenshot dimensions differ from the requested viewport.');
    result.screenshot = `${name}.png`;
    result.metrics = `${name}.json`;
    await writeFile(path.join(config.out, result.screenshot), png);
    await writeFile(path.join(config.out, result.metrics), `${JSON.stringify({ ...measured, capture: { section: name, position: result.position, png: dimensions }, errors, warnings }, null, 2)}\n`);
    result.status = errors.length ? 'captured-with-errors' : 'captured';
  } catch (error) {
    record('capture', { message: error.message });
    // Preserve actual state on positioning failure as useful diagnostic evidence.
    if (await page.locator(selectors[name]).count().catch(() => 0)) {
      const measured = await metrics(page, selectors[name]).catch(() => null);
      if (measured) {
        result.metrics = `${name}.json`;
        await writeFile(path.join(config.out, result.metrics), `${JSON.stringify({ ...measured, capture: { section: name, failed: true, position: result.position }, errors, warnings }, null, 2)}\n`);
      }
    }
  } finally {
    page.removeAllListeners();
    await context.close();
  }
  return result;
}

async function main() {
  const config = options(process.argv.slice(2));
  if (!config) { console.log(help); return; }
  await mkdir(config.out, { recursive: true });
  const report = { createdAt: new Date().toISOString(), origin: 'http://127.0.0.1:3000', config, browser: null, captures: [], errors: [] };
  let browser;
  try {
    const executablePath = browserExecutable();
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    report.browser = { version: browser.version(), executable: executablePath || chromium.executablePath() };
    for (const name of config.section === 'all' ? Object.keys(selectors) : [config.section]) {
      const result = await capture(browser, config, name);
      report.captures.push(result);
      console.log(`${name}: ${result.status}${result.errors.length ? ` (${result.errors.length} errors)` : ''}`);
    }
  } catch (error) {
    report.errors.push({ type: 'browser', message: error.message });
  } finally {
    if (browser) await browser.close();
    await writeFile(path.join(config.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`Report: ${path.join(config.out, 'report.json')}`);
  if (report.errors.length || report.captures.some(c => c.status !== 'captured')) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
