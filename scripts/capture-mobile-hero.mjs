import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const directory = 'output/visual/wide-final-mobile';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const measurements = [];
try {
  for (const width of [320, 390]) for (const locale of ['ru', 'en']) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:3000/${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-portrait]').evaluate(image => image.decode());
    await page.locator('[data-hero]').screenshot({ path: `${directory}/hero-${width}-${locale}.png` });
    measurements.push(await page.locator('[data-hero]').evaluate((hero, details) => ({ ...details, heroHeight: hero.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth - innerWidth, photo: getComputedStyle(hero.querySelector('[data-portrait]')).maskImage }), { width, locale }));
    await page.close();
  }
  await writeFile(`${directory}/hero-report.json`, JSON.stringify(measurements, null, 2));
  console.log(JSON.stringify(measurements));
} finally { await browser.close(); }
