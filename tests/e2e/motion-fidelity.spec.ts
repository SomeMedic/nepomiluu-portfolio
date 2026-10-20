import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { noOverflow, watchBrowserErrors } from './helpers';

test('footer geometry stays identical after normal and reduced motion reveals', async ({ browser }, testInfo) => {
  const measurements = [];
  for (const locale of ['ru', 'en'] as const) {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      const context = await browser.newContext({ viewport: { width: 1586, height: 992 }, reducedMotion });
      const page = await context.newPage();
      const errors = watchBrowserErrors(page);
      try {
        await page.goto(`/${locale}`);
        await page.evaluate(() => document.fonts.ready);
        const footer = page.locator('[data-home-footer]');
        const targets = footer.locator('[data-footer-reveal]');
        if (reducedMotion === 'no-preference') await expect(targets.first()).toHaveCSS('opacity', '0');
        await page.locator('a[href="#contacts"]').first().click();
        await expect(page).toHaveURL(/#contacts$/);
        await expect(footer).toBeInViewport();
        // Compare both motion modes at the same reference frame; native reduced
        // motion anchors retain the document's scroll margin and padding.
        await footer.evaluate(element => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top, behavior: 'instant' }));
        await expect.poll(async () => Math.abs((await footer.boundingBox())!.y)).toBeLessThan(1);
        for (const target of await targets.all()) await expect(target).toHaveCSS('opacity', '1');
        measurements.push(await footer.evaluate((element, mode) => {
          const heading = element.querySelector('h2')!;
          const contacts = element.querySelector('a[href="https://t.me/nepomiluu"]')!.parentElement!;
          const footerBox = element.getBoundingClientRect();
          const headingBox = heading.getBoundingClientRect();
          const contactsBox = contacts.getBoundingClientRect();
          const spread = heading.parentElement!;
          return {
            locale: element.getAttribute('data-locale'), mode,
            footerTop: footerBox.top, footerHeight: footerBox.height,
            headingTop: headingBox.top, headingOffset: headingBox.top - footerBox.top,
            contactsTop: contactsBox.top, contactsOffset: contactsBox.top - footerBox.top,
            spreadTransform: getComputedStyle(spread).transform,
          };
        }, reducedMotion));
        await noOverflow(page);
        await page.screenshot({ path: testInfo.outputPath(`footer-${locale}-${reducedMotion}-1586x992.png`) });
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }
  }
  await writeFile(testInfo.outputPath('footer-geometry.json'), JSON.stringify(measurements, null, 2));
  for (const measured of measurements) {
    expect(measured.spreadTransform).toBe('none');
    expect(measured.headingTop).toBeGreaterThanOrEqual(250);
    expect(measured.headingOffset).toBeCloseTo(992 * 0.254, 0);
    expect(measured.contactsOffset).toBeCloseTo(992 * 0.1643, 0);
  }
  for (const locale of ['ru', 'en']) {
    const normal = measurements.find(item => item.locale === locale && item.mode === 'no-preference')!;
    const reduced = measurements.find(item => item.locale === locale && item.mode === 'reduce')!;
    expect(normal.headingOffset).toBeCloseTo(reduced.headingOffset, 1);
    expect(normal.contactsOffset).toBeCloseTo(reduced.contactsOffset, 1);
  }
});

test('experience curve finishes at the section top and reverses before its entrance', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const errors = watchBrowserErrors(page);
  const measurements = [];
  for (const locale of ['ru', 'en'] as const) {
    await page.goto(`/${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('[data-home-footer] [data-footer-reveal]').first()).toHaveCSS('opacity', '0');
    const section = page.locator('[data-experience]');
    const curve = section.locator('[data-draw]');
    const scrollToSection = async (offset: number) => {
      await section.evaluate((element, distance) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - distance, behavior: 'instant' }), offset);
      await expect.poll(async () => (await section.boundingBox())!.y).toBeCloseTo(offset, 0);
    };
    await scrollToSection(0);
    await expect(curve).toHaveCSS('stroke-dashoffset', '0px');
    measurements.push(await curve.evaluate(element => ({ locale: document.documentElement.lang, phase: 'complete', length: (element as SVGGeometryElement).getTotalLength(), offset: Number.parseFloat(getComputedStyle(element).strokeDashoffset) })));
    await page.screenshot({ path: testInfo.outputPath(`experience-${locale}-complete-1586x992.png`) });
    await scrollToSection(992);
    // A non-scaling stroke uses projected screen units rather than viewBox
    // units. Its hidden offset must equal the full, viewport-sized dash.
    await expect.poll(async () => curve.evaluate(element => Math.abs(Number.parseFloat(getComputedStyle(element).strokeDashoffset) - Number.parseFloat(getComputedStyle(element).strokeDasharray)))).toBeLessThan(1);
    expect(await curve.evaluate(element => Number.parseFloat(getComputedStyle(element).strokeDasharray) - element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(0);
    measurements.push(await curve.evaluate(element => ({ locale: document.documentElement.lang, phase: 'reversed', length: (element as SVGGeometryElement).getTotalLength(), offset: Number.parseFloat(getComputedStyle(element).strokeDashoffset) })));
    await scrollToSection(0);
    await expect(curve).toHaveCSS('stroke-dashoffset', '0px');
  }
  await writeFile(testInfo.outputPath('experience-draw.json'), JSON.stringify(measurements, null, 2));
  expect(errors).toEqual([]);
});

test('footer opacity follows scroll in both directions without moving its layout', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/ru');
  await page.evaluate(() => document.fonts.ready);
  const footer = page.locator('[data-home-footer]');
  const target = footer.locator('[data-footer-reveal]').first();
  const evidence = [];
  const at = async (position: number) => {
    await footer.evaluate((element, fraction) => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - innerHeight * fraction, behavior: 'instant' }), position);
    let previous = '', stable = 0;
    await expect.poll(async () => {
      const current = await target.evaluate(element => getComputedStyle(element).opacity);
      stable = current === previous ? stable + 1 : 0;
      previous = current;
      return stable;
    }, { intervals: [100] }).toBeGreaterThanOrEqual(4);
    const sample = await target.evaluate(element => ({ opacity: Number(getComputedStyle(element).opacity), transform: (element as HTMLElement).style.transform }));
    evidence.push({ position, ...sample });
    expect(sample.transform).toBe('');
    return sample.opacity;
  };
  expect(await at(1)).toBe(0);
  const entering = await at(.75);
  expect(entering).toBeGreaterThan(0);
  expect(entering).toBeLessThan(1);
  expect(await at(.5)).toBe(1);
  expect(await at(.75)).toBeCloseTo(entering, 2);
  expect(await at(1)).toBe(0);
  await writeFile(testInfo.outputPath('footer-scrub.json'), JSON.stringify(evidence, null, 2));
});

test('pinned choreography changes composition, reverses, and clears for reduced motion', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = watchBrowserErrors(page);
  const evidence = [];
  for (const locale of ['ru', 'en']) {
    await page.goto(`/${locale}`);
    await page.evaluate(() => document.fonts.ready);
    const logic = page.locator('#about');
    await expect(logic).toHaveAttribute('data-enhanced', 'true');
    const motionSample = () => logic.evaluate(element => ['[data-logic-part="0"]', '[data-logic-part="1"]', '[data-logic-part="2"]', '[data-logic-result]'].map(selector => {
      const target = element.querySelector(selector)!;
      const style = getComputedStyle(target);
      return { selector, opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42 };
    }));
    const go = async (progress: number) => {
      await logic.evaluate((element, fraction) => {
        const spacer = element.parentElement!;
        const start = scrollY + spacer.getBoundingClientRect().top;
        const distance = Number.parseFloat(getComputedStyle(spacer).paddingBottom);
        window.scrollTo({ top: start + distance * fraction, behavior: 'instant' });
      }, progress);
      let previous = '';
      let stable = 0;
      await expect.poll(async () => {
        const current = JSON.stringify(await motionSample());
        stable = current === previous ? stable + 1 : 0;
        previous = current;
        return stable;
      }, { intervals: [100] }).toBeGreaterThanOrEqual(4);
      const sample = await motionSample();
      evidence.push({ locale, progress, sample });
      return sample;
    };
    const beginning = await go(0);
    const curve = logic.locator('[data-draw]');
    expect(await curve.evaluate(element => Number.parseFloat(getComputedStyle(element).strokeDasharray) - element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(0);
    expect(await curve.evaluate(element => Math.abs(Number.parseFloat(getComputedStyle(element).strokeDashoffset) - Number.parseFloat(getComputedStyle(element).strokeDasharray)))).toBeLessThan(1);
    expect(beginning[0]!.opacity).toBe(1);
    expect(beginning[1]!.opacity).toBe(0);
    expect(beginning[1]!.y).toBeGreaterThan(40);
    const entering = await go(.25);
    expect(entering[1]!.opacity).toBeGreaterThan(.2);
    expect(entering[1]!.opacity).toBeLessThan(.9);
    expect(entering[1]!.y).toBeGreaterThan(5);
    expect(entering[1]!.y).toBeLessThan(beginning[1]!.y);
    expect(entering[3]!.opacity).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`logic-${locale}-entering.png`) });
    const complete = await go(.85);
    for (const target of complete) { expect(target.opacity).toBe(1); expect(Math.abs(target.y)).toBeLessThan(.1); }
    await expect(curve).toHaveCSS('stroke-dashoffset', '0px');
    await page.screenshot({ path: testInfo.outputPath(`logic-${locale}-complete.png`) });
    const reversed = await go(.25);
    for (let index = 0; index < entering.length; index++) {
      expect(reversed[index]!.opacity).toBeCloseTo(entering[index]!.opacity, 2);
      expect(reversed[index]!.y).toBeCloseTo(entering[index]!.y, 0);
    }
    for (const index of [0, 1, 2, 1, 0]) {
      await page.locator(`#process a[href="#process-stage-${index}"]`).click();
      const stage = page.locator(`#process-stage-${index}`);
      await expect(stage).toHaveAttribute('data-active', 'true');
      for (const target of await stage.locator(':scope > h3, :scope > p').all()) {
        await expect(target).toHaveCSS('opacity', '1');
        await expect.poll(() => target.evaluate(element => Math.abs(new DOMMatrixReadOnly(getComputedStyle(element).transform).m42))).toBeLessThan(.1);
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-enhanced="true"]')).toHaveCount(0);
    for (const target of await page.locator('#about [data-logic-part], #about [data-logic-result], #process [data-stage] h3, #process [data-stage] p').all()) {
      await expect(target).toHaveCSS('opacity', '1');
      // The type system may have a static scaleX. Cleanup must remove GSAP's
      // inline motion while retaining that authored typography transform.
      expect(await target.evaluate(element => (element as HTMLElement).style.transform)).toBe('');
      expect(await target.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBe(0);
    }
    await noOverflow(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  await writeFile(testInfo.outputPath('choreography.json'), JSON.stringify(evidence, null, 2));
  expect(errors).toEqual([]);
});
