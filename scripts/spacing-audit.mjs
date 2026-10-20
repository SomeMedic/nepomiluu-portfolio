import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'output/visual/space-final';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = { cases: [], failures: [] };
try {
  for (const [width, height] of [[320,740],[390,844],[768,1024],[1024,768],[1440,900],[1586,992],[1920,1010],[1920,1080],[2560,1440]]) {
    for (const locale of ['ru','en']) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:3000/${locale}`);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('[data-portrait]').evaluate(image => image.decode());
      const metrics = await page.evaluate(() => {
        const rect = el => {
          const r = el.getBoundingClientRect();
          return { x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right };
        };
        const scene = document.querySelector('#about');
        const art = scene.querySelector('[data-logic-part="1"]');
        const medical = scene.querySelector('[data-logic-part="0"]');
        const line = scene.querySelector('[data-draw]').closest('svg');
        const lastCopyBottom = Math.max(rect(art.querySelector('p')).bottom, rect(medical.querySelector('p')).bottom);
        const photo = document.querySelector('[data-portrait]').parentElement;
        const hero = document.querySelector('[data-hero]');
        return {
          overflow: Math.max(0,document.documentElement.scrollWidth-innerWidth),
          captionToLine: rect(line).y-lastCopyBottom,
          artHeadingToCaption: rect(art.querySelector('h3')).y-rect(art.querySelector('h2')).bottom,
          medicalHeadingToCaption: rect(medical.querySelector('h3')).y-rect(medical.querySelector('h2')).bottom,
          photoInsideHero: rect(photo).x>=rect(hero).x && rect(photo).right<=rect(hero).right && rect(photo).bottom<=rect(hero).bottom,
          photoFrame: rect(photo),
          heroHeight: rect(hero).height,
          artRight: rect(art.querySelector('h2')).right,
          originalPhoto: document.querySelector('[data-portrait]').getAttribute('src'),
        };
      });
      const name = `${width}x${height}-${locale}`;
      const failures = [];
      if (metrics.overflow > 1) failures.push('horizontal overflow');
      if (metrics.captionToLine < 32) failures.push('line too close to caption');
      if (metrics.artHeadingToCaption < 20 || metrics.medicalHeadingToCaption < 20) failures.push('heading/caption too close');
      if (!metrics.photoInsideHero) failures.push('portrait frame leaves hero');
      if (metrics.originalPhoto !== '/assets/portrait-source-lossless.webp') failures.push('photo source changed');
      failures.push(...errors);
      if ([320,390,1024,1586,1920,2560].includes(width)) {
        await page.locator('[data-hero]').screenshot({ path: `${out}/${name}-hero.png` });
        await page.locator('#about').screenshot({ path: `${out}/${name}-logic.png` });
      }
      report.cases.push({ name, metrics, failures });
      report.failures.push(...failures.map(failure => ({ name, failure })));
      await page.close();
    }
  }
} finally { await browser.close(); }
await writeFile(`${out}/spacing-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({ cases:report.cases.length, failures:report.failures }));
if (report.failures.length) process.exitCode=1;
