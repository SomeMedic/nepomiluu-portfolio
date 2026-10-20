import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Read-only snapshots of real scroll positions; no style or GSAP-state injection.
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const output = path.resolve(option('--out') || 'output/visual/wide-motion-checks/choreography');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const report = { createdAt: new Date().toISOString(), browser: browser.version(), cases: [], failures: [] };

async function measure(page) {
  return page.evaluate(() => {
    const read = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(style.transform);
      return { opacity: Number(style.opacity), y: matrix.m42, scale: matrix.m11, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    return {
      scrollY, overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      logic: [0, 1, 2].map(index => read(`#about [data-logic-part="${index}"]`)),
      result: read('#about [data-logic-result]'),
      curve: (() => {
        const element = document.querySelector('#about [data-draw]');
        const style = getComputedStyle(element);
        return { dash: Number.parseFloat(style.strokeDasharray), offset: Number.parseFloat(style.strokeDashoffset), width: element.getBoundingClientRect().width };
      })(),
      process: [...document.querySelectorAll('#process [data-stage]')].map(element => ({ index: element.dataset.stage, active: element.dataset.active, heading: read(`#${element.id} h3`), body: read(`#${element.id} p`) })),
      clypse: read('#clypse-stage-1 > :first-child'),
      clypseBounds: (() => {
        const stage = document.querySelector('#clypse-stage-1');
        const scene = stage.closest('section');
        return { navigation: scene.querySelector('nav').getBoundingClientRect().toJSON(), heading: scene.querySelector('h2').getBoundingClientRect().toJSON(), scene: scene.getBoundingClientRect().toJSON() };
      })(),
      fomina: read('#fomina-stage-1 > :first-child'),
      fominaBounds: (() => {
        const stage = document.querySelector('#fomina-stage-1');
        const scene = stage.closest('section');
        return { navigation: scene.querySelector('nav').getBoundingClientRect().toJSON(), heading: scene.querySelector('h2').getBoundingClientRect().toJSON(), scene: scene.getBoundingClientRect().toJSON() };
      })(),
      fominaTitle: read('#fomina [data-parallax-title]'),
      fominaClosing: read('#fomina [data-parallax-bottom]'),
    };
  });
}

async function settle(page) {
  let previous = '', stable = 0;
  for (let count = 0; count < 45; count++) {
    const current = JSON.stringify(await measure(page));
    stable = current === previous ? stable + 1 : 0;
    if (stable >= 4) return;
    previous = current;
    await page.waitForTimeout(100);
  }
  throw new Error('Motion did not settle within 4.5 seconds');
}

async function scrollScene(page, selector, progress) {
  await page.locator(selector).evaluate((element, fraction) => {
    const spacer = element.parentElement;
    if (element.getAttribute('data-enhanced') !== 'true' || !spacer?.classList.contains('pin-spacer')) throw new Error(`Scene ${element.id} is not pinned`);
    const start = scrollY + spacer.getBoundingClientRect().top;
    window.scrollTo({ top: start + Number.parseFloat(getComputedStyle(spacer).paddingBottom) * fraction, behavior: 'instant' });
  }, progress);
  await settle(page);
  return measure(page);
}

try {
  for (const [width, height] of [[1920, 1080], [2560, 1440]]) for (const locale of ['ru', 'en']) {
    if (option('--width') && Number(option('--width')) !== width || option('--locale') && option('--locale') !== locale) continue;
    const folder = path.join(output, `${width}x${height}-${locale}`);
    await mkdir(folder, { recursive: true });
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const result = { width, height, locale, frames: [], errors: [], checks: [] };
    const check = (condition, message) => { result.checks.push({ pass: condition, message }); if (!condition) report.failures.push({ width, locale, message }); };
    page.on('pageerror', error => result.errors.push(error.message));
    try {
      await page.goto(`http://127.0.0.1:3000/${locale}`);
      await page.evaluate(() => document.fonts.ready);
      for (const selector of ['#fomina', '#about', '#process', '#contacts']) {
        await page.locator(selector).evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top, behavior: 'instant' }));
        await page.waitForTimeout(250);
      }
      await page.evaluate(() => Promise.all([...document.images].filter(image => image.complete).map(image => image.decode().catch(() => {}))));
      await settle(page);
      for (const progress of [0, .25, .5, .7, .9, .25, 0]) {
        const sample = await scrollScene(page, '#about', progress);
        const index = result.frames.length;
        const filename = `logic-${index}-${Math.round(progress * 100)}.png`;
        await page.screenshot({ path: path.join(folder, filename), scale: 'css' });
        result.frames.push({ scene: 'logic', progress, screenshot: filename, ...sample });
        check(sample.overflow === 0, `Logic ${progress}: no page overflow`);
      }
      const first = result.frames[0], entering = result.frames[1], complete = result.frames[4], reversed = result.frames[5];
      check(first.logic[0]?.opacity === 1 && first.logic[1]?.opacity === 0, 'Logic starts with medical preparation readable');
      check(first.curve.dash >= first.curve.width && Math.abs(first.curve.offset - first.curve.dash) < 1, 'Logic curve is fully hidden before drawing, including non-scaling strokes');
      check(entering.logic[1]?.opacity > .2 && entering.logic[1]?.opacity < .9 && entering.logic[1]?.y > 5, 'Art has a perceptible intermediate scroll frame');
      check(complete.logic.every(item => item?.opacity === 1 && Math.abs(item.y) < .1) && complete.result?.opacity === 1, 'Logic finishes with all content readable');
      check(complete.curve.offset === 0, 'Logic curve finishes at its actual endpoint');
      check(Math.abs(entering.logic[1].y - reversed.logic[1].y) < .5 && Math.abs(entering.logic[1].opacity - reversed.logic[1].opacity) < .01, 'Logic reverses to the same frame');
      for (const [scene, selector] of [['process', '#process'], ['clypse', '#projects'], ['fomina', '#fomina']]) {
        const transitionFrames = [];
        for (const progress of [.345, .38, .5, .64, .5]) {
          const sample = await scrollScene(page, selector, progress);
          const filename = `${scene}-${result.frames.length}-${Math.round(progress * 1000)}.png`;
          await page.screenshot({ path: path.join(folder, filename), scale: 'css' });
          result.frames.push({ scene, progress, screenshot: filename, ...sample });
          transitionFrames.push(sample);
          check(sample.overflow === 0, `${scene} ${progress}: no page overflow`);
          if (scene === 'process' && progress === .5) check(sample.process[1].active === 'true' && sample.process[1].heading.opacity === 1 && Math.abs(sample.process[1].heading.y) < .1 && sample.process[1].body.opacity === 1, 'Process stage centre is fully readable');
          if (scene === 'clypse' || scene === 'fomina') {
            const frame = sample[scene], bounds = sample[`${scene}Bounds`];
            const separate = rect => frame.left >= rect.right - 1 || frame.right <= rect.left + 1 || frame.top >= rect.bottom - 1 || frame.bottom <= rect.top + 1;
            check(separate(bounds.navigation) && separate(bounds.heading) && frame.top >= bounds.scene.top - 1 && frame.bottom <= bounds.scene.bottom + 1, `${scene} ${progress}: animated frame stays clear of navigation, heading and scene boundary`);
            if (progress === .5) check(frame.opacity === 1 && Math.abs(frame.y) < .1 && Math.abs(frame.scale - 1) < .001, `${scene} stage centre is fully readable`);
          }
        }
        if (scene !== 'process') {
          const start = transitionFrames[0][scene], centre = transitionFrames[2][scene], reversed = transitionFrames[4][scene];
          check(start.opacity > .25 && start.opacity < .9 && start.scale > .94 && start.scale < 1, `${scene} has a perceptible intermediate arrival frame`);
          check(centre.opacity === reversed.opacity && Math.abs(centre.scale - reversed.scale) < .001, `${scene} returns to the same central frame when scrolling backwards`);
        }
      }
      const closingFrames = [];
      for (const progress of [.73, .85, .99, .85, .73]) {
        const sample = await scrollScene(page, '#fomina', progress);
        const filename = `fomina-closing-${result.frames.length}-${Math.round(progress * 100)}.png`;
        await page.screenshot({ path: path.join(folder, filename), scale: 'css' });
        result.frames.push({ scene: 'fomina-closing', progress, screenshot: filename, ...sample });
        closingFrames.push(sample.fominaClosing);
      }
      check(closingFrames[0].opacity === .4 && closingFrames[2].opacity === 1 && closingFrames[2].y === 0, 'Fomina closing phrase reveals with the final stage');
      check(Math.abs(closingFrames[1].opacity - closingFrames[3].opacity) < .001 && Math.abs(closingFrames[1].y - closingFrames[3].y) < .1, 'Fomina closing phrase reverses to the same intermediate frame');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await settle(page);
      const reduced = await measure(page);
      result.reduced = reduced;
      check(await page.locator('[data-enhanced="true"]').count() === 0, 'Reduced motion removes pins');
      check(reduced.logic.every(item => item.opacity === 1 && item.y === 0) && reduced.result.opacity === 1, 'Reduced motion clears Logic choreography');
      check(reduced.process.every(item => item.heading.opacity === 1 && item.heading.y === 0 && item.body.opacity === 1), 'Reduced motion clears every process stage');
      check(reduced.fomina.scale === 1 && reduced.fomina.y === 0, 'Reduced motion clears Fomina screen motion');
      check(reduced.fominaTitle.opacity === 1 && reduced.fominaTitle.y === 0, 'Reduced motion clears Fomina title motion');
      check(reduced.fominaClosing.opacity === 1 && reduced.fominaClosing.y === 0, 'Reduced motion clears Fomina closing phrase motion');
      check(reduced.clypse.scale === 1 && reduced.clypse.opacity === 1, 'Reduced motion clears Clypse screen motion');
      check(result.errors.length === 0, 'No JavaScript page errors');
    } catch (error) { check(false, error.message); }
    await writeFile(path.join(folder, 'report.json'), JSON.stringify(result, null, 2));
    report.cases.push(result);
    await context.close();
    console.log(`${width}x${height} ${locale}: ${result.checks.filter(item => !item.pass).length} failures`);
  }
} finally {
  await browser.close();
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Report: ${output}/report.json`);
  if (report.failures.length) process.exitCode = 1;
}
