import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Read-only browser evidence against the already-running local preview. This
// script never starts services, alters styles, or drives internal GSAP state.
const args = process.argv.slice(2);
const outputArgument = args.indexOf('--out');
const output = path.resolve(outputArgument < 0 ? 'output/visual/wide-motion-checks/current' : args[outputArgument + 1]);
const onlyWidth = args.includes('--width') ? Number(args[args.indexOf('--width') + 1]) : null;
const onlyLocale = args.includes('--locale') ? args[args.indexOf('--locale') + 1] : null;
const base = 'http://127.0.0.1:3000';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const scenes = ['[data-hero]', '[data-scene="clypse"]', '#fomina', '#about', '#experience', '#process', '[data-home-footer]'];
const colourChapters = [
  { name: 'fomina', selector: '#fomina', from: [248, 245, 239], to: [232, 209, 195] },
  { name: 'about', selector: '#about', from: [232, 209, 195], to: [248, 245, 239] },
  { name: 'footer', selector: '[data-home-footer]', from: [248, 245, 239], to: [233, 209, 196] },
];

async function settle(page) {
  let previous = '';
  let stable = 0;
  for (let index = 0; index < 50; index++) {
    const current = await page.evaluate(() => JSON.stringify({
      y: Math.round(scrollY * 10),
      height: document.documentElement.scrollHeight,
      body: getComputedStyle(document.body).backgroundColor,
      stages: [...document.querySelectorAll('[data-scene]')].map(el => [el.dataset.current, Math.round(el.getBoundingClientRect().top * 10), el.getAttribute('style')]),
    }));
    stable = current === previous ? stable + 1 : 0;
    if (stable >= 5) return true;
    previous = current;
    await page.waitForTimeout(100);
  }
  return false;
}

async function scroll(page, y) {
  await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), y);
  return settle(page);
}

async function origin(page, selector) {
  return page.locator(selector).evaluate(el => {
    const parent = el.parentElement;
    const origin = parent?.classList.contains('pin-spacer') ? parent : el;
    return { y: scrollY + origin.getBoundingClientRect().top, pinned: origin !== el, height: el.getBoundingClientRect().height };
  });
}

async function screenshot(page, folder, name) {
  const file = path.join(folder, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false, scale: 'css', caret: 'hide' });
  return path.relative(output, file).replaceAll('\\', '/');
}

async function sample(page) {
  return page.evaluate(() => {
    const box = element => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const overlaps = (a, b) => !!a && !!b && Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
    const active = document.querySelector('#process [data-active="true"]') || document.querySelector('#process [data-stage]');
    const heading = box(active?.querySelector('h3'));
    const paragraph = box(active?.querySelector('p'));
    const footer = document.querySelector('[data-home-footer]');
    const contactColumn = footer?.querySelector('a[href^="https://t.me"]')?.parentElement;
    const contactBox = box(contactColumn);
    const footerLines = [...footer.querySelectorAll('h2 > *')].map(el => ({ text: el.textContent, box: box(el) }));
    const heroHeading = box(document.querySelector('[data-hero] h2'));
    const portrait = box(document.querySelector('[data-portrait]'));
    return {
      scrollY, viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      background: getComputedStyle(document.body).backgroundColor,
      surfaces: [...document.querySelectorAll('[data-home] section, [data-home-footer]')].map(el => ({
        id: el.id || 'hero', scene: el.dataset.scene || null, enhanced: el.dataset.enhanced || null,
        pinned: el.parentElement?.classList.contains('pin-spacer') || false,
        background: getComputedStyle(el).backgroundColor,
        backgroundImage: getComputedStyle(el).backgroundImage,
      })),
      process: { stage: active?.dataset.stage, heading, paragraph, boxesOverlap: overlaps(heading, paragraph) },
      footer: { lines: footerLines, contacts: contactBox, boxesOverlap: footerLines.some(line => overlaps(line.box, contactBox)) },
      hero: { heading: heroHeading, portrait, boxesOverlap: overlaps(heroHeading, portrait), caveat: 'Portrait rectangle includes transparent pixels; this flag is a visual-review prompt, not proof of silhouette collision.' },
    };
  });
}

function rgb(value) {
  return value.match(/[\d.]+/g).slice(0, 3).map(Number);
}
function channelDistance(actual, expected) {
  return Math.max(...rgb(actual).map((channel, index) => Math.abs(channel - expected[index])));
}
function expect(result, condition, message, details = {}) {
  result.checks.push({ status: condition ? 'pass' : 'fail', message, ...details });
}

async function prepare(page, locale) {
  const response = await page.goto(`${base}/${locale}`, { waitUntil: 'load', timeout: 60000 });
  if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1100);
  // Enter every scene once to let real lazy images finish and native scene
  // observers rebuild pin spacing before measuring chapter offsets.
  for (const selector of scenes) {
    await scroll(page, (await origin(page, selector)).y);
    await page.locator(selector).evaluate(async section => {
      await Promise.race([
        Promise.all([...section.querySelectorAll('img')].map(async image => {
          if (!image.complete) await new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); });
          if (image.naturalWidth) await image.decode().catch(() => {});
        })),
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]);
    });
    await settle(page);
  }
  await scroll(page, 0);
}

async function chapterCheck(page, result, chapter, folder, screenshots) {
  const record = { name: chapter.name, forward: [], reverse: [] };
  for (const direction of ['forward', 'reverse']) {
    for (const progress of direction === 'forward' ? [0, 0.25, 0.5, 0.75, 1] : [1, 0.75, 0.5, 0.25, 0]) {
      const boundary = await origin(page, chapter.selector);
      const viewport = page.viewportSize();
      const requestedY = boundary.y - viewport.height * (0.8 - progress * 0.6);
      await scroll(page, requestedY);
      const actual = await sample(page);
      const expected = chapter.from.map((channel, i) => Math.round(channel + (chapter.to[i] - channel) * progress));
      const item = { progress, boundary, requestedY, scrollY: actual.scrollY, background: actual.background, expected, overflow: actual.overflow };
      record[direction].push(item);
      expect(result, Math.abs(actual.scrollY - requestedY) < 2, `${chapter.name} ${direction} ${progress}: scroll target reached`, { actual: actual.scrollY, expected: requestedY });
      expect(result, channelDistance(actual.background, expected) <= 2, `${chapter.name} ${direction} ${progress}: global colour interpolated`, { actual: actual.background, expected });
      expect(result, actual.overflow === 0, `${chapter.name} ${direction} ${progress}: no horizontal page overflow`);
      if (screenshots && direction === 'forward' && progress > 0 && progress < 1) item.screenshot = await screenshot(page, folder, `${chapter.name}-${progress * 100}`);
    }
  }
  for (const forward of record.forward) {
    const backward = record.reverse.find(item => item.progress === forward.progress);
    expect(result, channelDistance(forward.background, rgb(backward.background)) <= 1, `${chapter.name} ${forward.progress}: forward/reverse colour agrees`);
  }
  result.chapters.push(record);
}

async function stageChecks(page, result, folder) {
  result.stages = [];
  for (const name of ['clypse', 'fomina', 'process']) {
    const selector = `[data-scene="${name}"]`;
    const count = await page.locator(`${selector} [data-step]`).count();
    expect(result, count === 3, `${name}: three stage links present`);
    for (const stage of [0, 1, 2, 1, 0]) {
      const link = page.locator(`${selector} a[href="#${name}-stage-${stage}"]`);
      await scroll(page, (await origin(page, selector)).y);
      await link.scrollIntoViewIfNeeded();
      await settle(page);
      try {
        await link.click({ timeout: 10000 });
        await page.waitForTimeout(900);
        await settle(page);
        const actual = await page.locator(selector).evaluate(el => ({ enhanced: el.dataset.enhanced, current: el.dataset.current, hash: location.hash, targetPresent: !!document.getElementById(location.hash.slice(1)) }));
        expect(result, actual.hash === `#${name}-stage-${stage}` && actual.targetPresent && (actual.enhanced !== 'true' || actual.current === String(stage)), `${name}: real click reaches stage ${stage}`, actual);
        result.stages.push({ scene: name, stage, ...actual });
        if (name === 'process') {
          const geometry = await sample(page);
          expect(result, !geometry.process.boxesOverlap, `process stage ${stage}: heading and explanation boxes do not overlap`, geometry.process);
          if (stage === 1) result.processScreenshot = await screenshot(page, folder, 'process-stage-1');
        }
      } catch (error) { expect(result, false, `${name}: stage ${stage} click failed`, { error: error.message }); }
    }
  }
}

async function normalCase(browser, width, height, locale) {
  const folder = path.join(output, `${width}x${height}-${locale}`);
  await mkdir(folder, { recursive: true });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'no-preference', locale: locale === 'ru' ? 'ru-RU' : 'en-US', colorScheme: 'light' });
  const page = await context.newPage();
  const result = { width, height, locale, motion: 'normal', checks: [], chapters: [], errors: [] };
  page.on('pageerror', error => result.errors.push(error.message));
  try {
    await prepare(page, locale);
    console.log(`${width}x${height} ${locale}: warmed all scenes`);
    result.initial = await sample(page);
    for (const surface of result.initial.surfaces) expect(result, surface.background === 'rgba(0, 0, 0, 0)' && surface.backgroundImage === 'none', `${surface.id}: transparent section surface after pinning`, surface);
    expect(result, result.initial.overflow === 0, 'Hero: no horizontal page overflow');
    if (!args.includes('--resize-only')) {
      result.heroScreenshot = await screenshot(page, folder, 'hero');
      for (const chapter of colourChapters) {
        await chapterCheck(page, result, chapter, folder, locale === 'ru');
        console.log(`${width}x${height} ${locale}: ${chapter.name} forward/reverse colour checked`);
      }
      await stageChecks(page, result, folder);
      await scroll(page, (await origin(page, '[data-home-footer]')).y);
      result.footer = await sample(page);
      expect(result, !result.footer.footer.boxesOverlap, 'Footer: heading and contact column boxes do not overlap', result.footer.footer);
      result.footerScreenshot = await screenshot(page, folder, 'footer');
    }

    // Resize while a real stage is active, then repeat the chapter colour check.
    const processLink = page.locator('#process a[href="#process-stage-1"]');
    await scroll(page, (await origin(page, '#process')).y);
    await processLink.scrollIntoViewIfNeeded();
    await settle(page);
    await processLink.click();
    await page.waitForTimeout(1000);
    await settle(page);
    await page.mouse.wheel(0, 1); // genuine input clears completed anchor intent
    await settle(page);
    const before = await page.locator('#process').getAttribute('data-current');
    const beforeResize = await sample(page);
    await page.setViewportSize(width === 1920 ? { width: 2560, height: 1440 } : { width: 1920, height: 1080 });
    await page.waitForTimeout(1100);
    await settle(page);
    const after = await page.locator('#process').getAttribute('data-current');
    const afterResize = await sample(page);
    result.resize = { before, after, beforeScrollY: beforeResize.scrollY, afterScrollY: afterResize.scrollY, viewport: page.viewportSize() };
    expect(result, before === '1' && after === '1', 'Resize preserves the active process stage', result.resize);
    await chapterCheck(page, result, colourChapters[0], folder, false);
    expect(result, result.errors.length === 0, 'No JavaScript page errors', { errors: result.errors });
  } catch (error) { expect(result, false, 'Case completed', { error: error.message }); }
  await writeFile(path.join(folder, 'report.json'), JSON.stringify(result, null, 2));
  await context.close();
  return result;
}

async function reducedCase(browser) {
  const folder = path.join(output, '390x844-ru-reduced');
  await mkdir(folder, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light' });
  const page = await context.newPage();
  const result = { width: 390, height: 844, locale: 'ru', motion: 'reduce', checks: [] };
  try {
    await prepare(page, 'ru');
    const enhanced = await page.locator('[data-enhanced="true"]').count();
    const pins = await page.locator('.pin-spacer').count();
    expect(result, enhanced === 0 && pins === 0, 'Reduced motion has no enhanced pins', { enhanced, pins });
    result.samples = [];
    for (const selector of scenes) {
      await scroll(page, (await origin(page, selector)).y);
      const actual = await sample(page);
      result.samples.push({ selector, background: actual.background, overflow: actual.overflow });
      expect(result, actual.background === 'rgb(248, 245, 239)', `${selector}: reduced motion keeps static paper surface`);
      expect(result, actual.overflow === 0, `${selector}: reduced motion has no horizontal overflow`);
    }
    for (const name of ['clypse', 'fomina', 'process']) {
      const stages = await page.locator(`[data-scene="${name}"] [data-stage]`).evaluateAll(elements => elements.map(el => ({ hidden: el.getAttribute('aria-hidden'), display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility })));
      expect(result, stages.length === 3 && stages.every(stage => stage.hidden !== 'true' && stage.display !== 'none' && stage.visibility !== 'hidden'), `${name}: all stages available in reduced flow`, { stages });
    }
    await scroll(page, (await origin(page, '#process')).y);
    result.screenshot = await screenshot(page, folder, 'process');
  } catch (error) { expect(result, false, 'Reduced case completed', { error: error.message }); }
  await writeFile(path.join(folder, 'report.json'), JSON.stringify(result, null, 2));
  await context.close();
  return result;
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const report = { createdAt: new Date().toISOString(), origin: base, browser: browser.version(), caveat: 'Geometry assertions identify coarse collisions only. Actual screenshots require a human/model visual review; this report does not certify aesthetics or silhouette overlap.', cases: [] };
try {
  for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
    if (onlyWidth && width !== onlyWidth) continue;
    for (const locale of ['ru', 'en']) {
      if (onlyLocale && locale !== onlyLocale) continue;
      const result = await normalCase(browser, width, height, locale);
      report.cases.push(result);
      console.log(`${width}x${height} ${locale}: ${result.checks.filter(check => check.status === 'fail').length} failed / ${result.checks.length} checks`);
    }
  }
  if (!args.includes('--skip-reduced')) report.cases.push(await reducedCase(browser));
} finally {
  await browser.close();
  report.summary = {
    passed: report.cases.flatMap(result => result.checks).filter(check => check.status === 'pass').length,
    failed: report.cases.flatMap(result => result.checks).filter(check => check.status === 'fail').length,
  };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Report: ${path.join(output, 'report.json')}`);
  console.log(JSON.stringify(report.summary));
  if (report.summary.failed) process.exitCode = 1;
}
