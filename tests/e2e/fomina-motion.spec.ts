import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { noOverflow, watchBrowserErrors } from './helpers';

test('Fomina supports direct anchors, three pinned screens and reversible transitions in RU and EN', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = watchBrowserErrors(page);
  const evidence = [];
  for (const locale of ['ru', 'en']) {
    await page.goto(`/${locale}#fomina-stage-1`);
    await page.evaluate(() => document.fonts.ready);
    const section = page.locator('#fomina');
    await expect(section).toHaveAttribute('data-enhanced', 'true');
    await expect(page.locator('#fomina-stage-1')).toHaveAttribute('data-active', 'true');
    const nav = section.locator('nav');
    await expect(nav.getByRole('link')).toHaveCount(3);
    for (const index of [2, 1, 0, 1]) {
      await nav.getByRole('link').nth(index).click();
      await expect(page).toHaveURL(new RegExp(`#fomina-stage-${index}$`));
      const stage = page.locator(`#fomina-stage-${index}`);
      await expect(stage).toHaveAttribute('data-active', 'true');
      await expect(stage).not.toHaveAttribute('aria-hidden', 'true');
      await expect(nav.getByRole('link').nth(index)).toHaveAttribute('aria-current', 'step');
      await expect(stage.locator('img')).toHaveJSProperty('complete', true);
      expect(await stage.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      for (const target of await stage.locator(':scope > *').all()) {
        await expect(target).toHaveCSS('opacity', '1');
        await expect.poll(() => target.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m11)).toBe(1);
      }
      await expect(stage.locator('img')).toBeInViewport({ ratio: 1 });
      expect(await section.evaluate(element => element.scrollHeight)).toBeLessThanOrEqual(1082);
      await noOverflow(page);
    }
    const sampleAt = async (progress: number) => {
      await section.evaluate((element, fraction) => {
        const spacer = element.parentElement!;
        const start = scrollY + spacer.getBoundingClientRect().top;
        window.scrollTo({ top: start + Number.parseFloat(getComputedStyle(spacer).paddingBottom) * fraction, behavior: 'instant' });
      }, progress);
      let previous = '', stable = 0;
      const sample = () => page.locator('#fomina-stage-1 > :first-child').evaluate(element => {
        const style = getComputedStyle(element);
        return { opacity: Number(style.opacity), scale: new DOMMatrixReadOnly(style.transform).m11 };
      });
      await expect.poll(async () => {
        const current = JSON.stringify(await sample());
        stable = current === previous ? stable + 1 : 0;
        previous = current;
        return stable;
      }, { intervals: [100] }).toBeGreaterThanOrEqual(4);
      const result = await sample();
      evidence.push({ locale, progress, ...result });
      return result;
    };
    const arriving = await sampleAt(.35);
    expect(arriving.opacity).toBeGreaterThan(.25);
    expect(arriving.opacity).toBeLessThan(.9);
    expect(arriving.scale).toBeGreaterThan(.94);
    expect(arriving.scale).toBeLessThan(1);
    await page.screenshot({ path: testInfo.outputPath(`fomina-${locale}-arriving.png`) });
    const centre = await sampleAt(.5);
    expect(centre).toEqual({ opacity: 1, scale: 1 });
    await page.screenshot({ path: testInfo.outputPath(`fomina-${locale}-centre.png`) });
    const reversed = await sampleAt(.35);
    expect(reversed.opacity).toBeCloseTo(arriving.opacity, 2);
    expect(reversed.scale).toBeCloseTo(arriving.scale, 3);
  }
  await writeFile(testInfo.outputPath('fomina-motion.json'), JSON.stringify(evidence, null, 2));
  expect(errors).toEqual([]);
});

test('Fomina mobile flow reveals each screen with scroll and retains native anchors', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = watchBrowserErrors(page);
  await page.goto('/ru');
  await page.evaluate(() => document.fonts.ready);
  const section = page.locator('#fomina');
  await expect(section).not.toHaveAttribute('data-enhanced', 'true');
  const stage = page.locator('#fomina-stage-1');
  const target = stage.locator(':scope > :first-child');
  const at = async (position: number) => {
    await stage.evaluate((element, fraction) => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - innerHeight * fraction, behavior: 'instant' }), position);
  };
  await at(.98);
  await expect(target).toHaveCSS('opacity', '0.4');
  await at(.4);
  await expect(target).toHaveCSS('opacity', '1');
  await expect.poll(() => target.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m11)).toBe(1);
  await at(.98);
  await expect(target).toHaveCSS('opacity', '0.4');
  await section.locator('a[href="#fomina-stage-2"]').click();
  await expect(page).toHaveURL(/#fomina-stage-2$/);
  const last = page.locator('#fomina-stage-2');
  await expect(last.locator('img')).toBeInViewport();
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const scene = document.getElementById('fomina')!;
    const observer = new MutationObserver(() => {
      observer.disconnect(); clearTimeout(timeout);
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error('No mobile scene rebuild')); }, 5000);
    observer.observe(scene, { attributes: true, attributeFilter: ['data-enhanced'] });
    window.dispatchEvent(new Event('resize'));
  }));
  await expect(last.locator('img')).toBeInViewport();
  expect(await last.evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(-2);
  expect(await last.evaluate(element => element.getBoundingClientRect().top)).toBeLessThanOrEqual(64);
  await page.screenshot({ path: testInfo.outputPath('fomina-mobile-flow.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-enhanced="true"]')).toHaveCount(0);
  for (const item of await section.locator('[data-stage]').all()) {
    await expect(item).not.toHaveAttribute('aria-hidden', 'true');
    for (const child of await item.locator(':scope > *').all()) {
      await expect(child).toHaveCSS('opacity', '1');
      expect(await child.evaluate(element => (element as HTMLElement).style.transform)).toBe('');
    }
  }
  await noOverflow(page);
  expect(errors).toEqual([]);
});
