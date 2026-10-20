import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { seedProjects } from '../../packages/contracts/src/seed';
import { fixtureContent } from './fixture-content';
import { adminRequest, noOverflow, state, watchBrowserErrors } from './helpers';

const sharp = createRequire(path.resolve('apps/api/package.json'))('sharp') as typeof import('../../apps/api/node_modules/sharp');
let owner: APIRequestContext;
let originalHome: { first: string; second: string };
let imageProject: string;
let longProject: string;

test.beforeAll(async ({ playwright }) => {
  const run = state();
  owner = await playwright.request.newContext({ baseURL: run.webUrl });
  expect((await owner.post('/api/admin/login', { data: { email: run.email, password: run.password } })).ok()).toBeTruthy();
  originalHome = await (await adminRequest(owner, '/home')).json();
  // A decoded, non-square raster exercises the real upload/derivative pipeline.
  // It is visibly a synthetic fixture and never enters the normal database/assets.
  const pixels = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#d8e8e4' } })
    .composite([{ input: Buffer.from('<svg width="1600" height="1000"><rect x="40" y="40" width="1520" height="920" rx="24" fill="#fcfaf6"/><path d="M400 80V920M1200 80V920M80 250H1520M80 750H1520" stroke="#bb573a" stroke-width="4"/><text x="800" y="500" text-anchor="middle" font-size="64" fill="#17130f">SYNTHETIC E2E FIXTURE 1600 x 1000</text></svg>') }]).png().toBuffer();
  const { csrfToken } = await (await owner.get('/api/admin/session')).json();
  const upload = await owner.post('/api/admin/media', { headers: { 'x-csrf-token': csrfToken }, multipart: { file: { name: 'synthetic-pin-fit.png', mimeType: 'image/png', buffer: pixels } } });
  expect(upload.ok()).toBeTruthy();
  const media = await upload.json();
  expect([media.width, media.height]).toEqual([1600, 1000]);
  const currentHome = seedProjects.find(project => project.slug === 'clypse')?.draft.home;
  if (!currentHome) throw new Error('Missing current Clypse seed content');
  for (const long of [false, true]) {
    const draft = fixtureContent('Проверка размещения экрана', 'Screen layout verification');
    // Use the current three-stage copy without editing the seed or its publication state.
    draft.home = { ...currentHome, stages: currentHome.stages.map((stage, index) => ({
      ...stage,
      image: { mediaId: media.id, alt: { ru: `Тестовый растр этапа ${index + 1}`, en: `Stage ${index + 1} test raster` } },
      body: long ? { ru: 'Длинное описание должно оставаться доступным в обычном потоке. '.repeat(100), en: 'A long description must remain readable in normal document flow. '.repeat(100) } : stage.body,
      annotations: [{ id: 'upper', x: .25, y: .25, text: { ru: 'Верхняя точка изображения.', en: 'Upper image coordinate.' } }, { id: 'lower', x: .75, y: .75, text: { ru: 'Нижняя точка изображения.', en: 'Lower image coordinate.' } }],
    })) };
    const project = await (await adminRequest(owner, '/projects', 'POST', { slug: `pin-${long ? 'long' : 'fit'}-${run.runId}`, draft })).json();
    await adminRequest(owner, `/projects/${project.id}/publish`, 'POST', { revision: project.revision });
    if (long) longProject = project.id; else imageProject = project.id;
  }
  await adminRequest(owner, '/home', 'PUT', { first: imageProject, second: originalHome.second });
});

test.afterAll(async () => {
  if (owner) {
    try { if (originalHome) await adminRequest(owner, '/home', 'PUT', originalHome); }
    finally { await owner.dispose(); }
  }
});

for (const locale of ['ru', 'en'] as const) for (const viewport of [{ width: 1586, height: 992 }, { width: 1920, height: 1080 }]) {
  test(`Clypse actual raster pins and fits all three stages: ${locale} ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const errors = watchBrowserErrors(page);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`/${locale}`);
    await page.evaluate(() => document.fonts.ready);
    const section = page.locator('#projects');
    await expect(section).toHaveAttribute('data-enhanced', 'true');
    const nav = section.getByRole('navigation');
    const measurements = [];
    for (const index of [0, 1, 2]) {
      await nav.getByRole('link').nth(index).click();
      await expect(page).toHaveURL(new RegExp(`#clypse-stage-${index}$`));
      const stage = page.locator(`#clypse-stage-${index}`);
      await expect(stage).toHaveAttribute('data-active', 'true');
      await expect(stage).not.toHaveAttribute('aria-hidden', 'true');
      await expect(stage.locator('img')).toHaveJSProperty('complete', true);
      await expect(stage.locator('img')).toHaveJSProperty('naturalWidth', 1600);
      await stage.locator('img').evaluate(image => (image as HTMLImageElement).decode());
      await expect(stage.locator(':scope > :first-child')).toHaveCSS('opacity', '1');
      await expect(nav.getByRole('link').nth(index)).toHaveAttribute('aria-current', 'step');
      await expect.poll(async () => Math.abs(await section.evaluate(element => element.getBoundingClientRect().top))).toBeLessThanOrEqual(2);
      const geometry = await stage.evaluate(element => {
        const rect = (item: Element) => { const r = item.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
        const scene = element.closest('section')!;
        const image = element.querySelector('img')!;
        return { scene: rect(scene), scrollHeight: scene.scrollHeight, heading: rect(scene.querySelector('h2')!), navigation: rect(scene.querySelector('nav')!), frame: rect(image.parentElement!.parentElement!), image: rect(image), natural: [image.naturalWidth, image.naturalHeight], caption: rect(element.querySelector('figcaption')!), markers: Array.from(element.querySelectorAll('summary'), rect) };
      });
      measurements.push({ index, ...geometry });
      expect(geometry.natural).toEqual([1600, 1000]);
      expect(geometry.scrollHeight).toBeLessThanOrEqual(viewport.height + 2);
      expect(geometry.frame.x).toBeGreaterThanOrEqual(geometry.heading.right + 24);
      for (const item of [geometry.frame, geometry.navigation]) {
        expect(item.x).toBeGreaterThanOrEqual(geometry.scene.x - 1);
        expect(item.right).toBeLessThanOrEqual(geometry.scene.right + 1);
        expect(item.y).toBeGreaterThanOrEqual(geometry.scene.y - 1);
        expect(item.bottom).toBeLessThanOrEqual(geometry.scene.bottom + 1);
      }
      expect(geometry.caption.bottom).toBeLessThanOrEqual(geometry.scene.bottom + 2);
      expect(geometry.frame.bottom).toBeLessThanOrEqual(geometry.caption.y);
      expect(geometry.image.y).toBeGreaterThanOrEqual(geometry.frame.y - 1);
      expect(geometry.image.bottom).toBeLessThanOrEqual(geometry.frame.bottom + 1);
      expect(geometry.image.x).toBeGreaterThanOrEqual(geometry.frame.x - 1);
      expect(geometry.image.right).toBeLessThanOrEqual(geometry.frame.right + 1);
      expect(geometry.image.width / geometry.image.height).toBeCloseTo(1.6, 2);
      for (const [markerIndex, fraction] of [.25, .75].entries()) {
        const marker = geometry.markers[markerIndex]!;
        expect(Math.abs(marker.x + marker.width / 2 - geometry.image.x - geometry.image.width * fraction)).toBeLessThanOrEqual(2);
        expect(Math.abs(marker.y + marker.height / 2 - geometry.image.y - geometry.image.height * fraction)).toBeLessThanOrEqual(2);
        const annotation = stage.locator('details').nth(markerIndex);
        await annotation.locator('summary').click();
        await expect(annotation).toHaveAttribute('open', '');
        await expect(annotation.locator('p')).toBeVisible();
        await expect(annotation.locator('p')).toBeInViewport({ ratio: 1 });
        await annotation.locator('summary').click();
      }
    }
    await noOverflow(page);
    const geometryFile = testInfo.outputPath('stage-geometry.json');
    await writeFile(geometryFile, JSON.stringify(measurements, null, 2));
    await testInfo.attach('stage-geometry', { path: geometryFile, contentType: 'application/json' });
    await page.screenshot({ path: testInfo.outputPath(`clypse-fit-${locale}-${viewport.width}x${viewport.height}.png`) });
    expect(errors).toEqual([]);
  });
}

test('Clypse long captions retain all three stages in normal document flow', async ({ page }, testInfo) => {
  const measurements = [];
  await adminRequest(owner, '/home', 'PUT', { first: longProject, second: originalHome.second });
  try {
    await page.setViewportSize({ width: 1586, height: 992 });
    for (const locale of ['ru', 'en']) {
      await page.goto(`/${locale}`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('#projects')).not.toHaveAttribute('data-enhanced', 'true');
      for (const index of [0, 1, 2]) {
        const stage = page.locator(`#clypse-stage-${index}`);
        await expect(stage).toBeVisible();
        await expect(stage).not.toHaveAttribute('aria-hidden', 'true');
        const caption = stage.locator('figcaption');
        expect(await caption.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(992);
        await page.locator('#projects nav a').nth(index).click();
        await expect(page).toHaveURL(new RegExp(`#clypse-stage-${index}$`));
        // Force the same debounced pin rebuild that image/font resizing requests.
        // Wait for its attribute pass and both animation frames, rather than a sleep.
        await page.evaluate(() => new Promise<void>((resolve, reject) => {
          const scene = document.getElementById('projects')!;
          const observer = new window.MutationObserver(() => {
            observer.disconnect(); window.clearTimeout(timeout);
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
          });
          const timeout = window.setTimeout(() => { observer.disconnect(); reject(new Error('No flow-scene rebuild after resize')); }, 5000);
          observer.observe(scene, { attributes: true, attributeFilter: ['data-enhanced'] });
          window.dispatchEvent(new Event('resize'));
        }));
        await expect(page.locator('#projects')).not.toHaveAttribute('data-enhanced', 'true');
        measurements.push({ locale, index, ...await stage.evaluate(element => ({ stageTop: element.getBoundingClientRect().top, scrollY: window.scrollY, enhanced: element.closest('section')!.getAttribute('data-enhanced') })) });
        await writeFile(testInfo.outputPath('flow-anchor-geometry.json'), JSON.stringify(measurements, null, 2));
        await expect(stage).toBeInViewport();
        await expect(stage.locator('img')).toBeInViewport();
        const stageTop = await stage.evaluate(element => element.getBoundingClientRect().top);
        expect(stageTop).toBeGreaterThanOrEqual(-2);
        expect(stageTop).toBeLessThanOrEqual(64);
        await expect(caption).toBeVisible();
        expect(await caption.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
      }
      await noOverflow(page);
    }
  } finally { await adminRequest(owner, '/home', 'PUT', { first: imageProject, second: originalHome.second }); }
});
