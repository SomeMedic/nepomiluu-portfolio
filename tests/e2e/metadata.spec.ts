import { expect, test } from '@playwright/test';
import { state } from './helpers';

test('social crawlers receive complete localized metadata in the initial HTML head', async ({ request }) => {
  const origin = state().webUrl;
  for (const userAgent of ['TelegramBot (like TwitterBot)', 'vkShare', 'Twitterbot/1.0', 'facebookexternalhit/1.1', 'Mozilla/5.0']) {
    for (const locale of ['ru', 'en']) {
      const response = await request.get(`/${locale}?utm_source=metadata-check`, { headers: { 'user-agent': userAgent, 'x-forwarded-host': 'untrusted.example' } });
      expect(response.status()).toBe(200);
      const head = (await response.text()).split('</head>')[0];
      expect(head).toContain(`<link rel="canonical" href="${origin}/${locale}"`);
      expect(head).toContain(`<meta property="og:url" content="${origin}/${locale}"`);
      expect(head).toContain(`<meta property="og:image" content="${origin}/social/portfolio-${locale}-v1.jpg"`);
      expect(head).toContain('<meta property="og:image:width" content="1200"');
      expect(head).toContain('<meta property="og:image:height" content="630"');
      expect(head).toContain('<meta property="og:image:type" content="image/jpeg"');
      expect(head).toContain('<meta name="twitter:card" content="summary_large_image"');
      expect(head).toContain(`<meta name="twitter:image" content="${origin}/social/portfolio-${locale}-v1.jpg"`);
      for (const [language, suffix] of [['ru', 'ru'], ['en', 'en'], ['x-default', 'ru']]) expect(head).toContain(`<link rel="alternate" hrefLang="${language}" href="${origin}/${suffix}"`);
      expect(head).not.toContain('og.svg');
      expect(head).not.toContain('untrusted.example');
    }
  }
});

test('metadata, author JSON-LD and case covers work without client JavaScript', async ({ browser, request }) => {
  const run = state();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const locale of ['ru', 'en']) {
      for (const suffix of ['', `/projects/${run.fixtures[0].slug}`]) {
        await page.goto(`${run.webUrl}/${locale}${suffix}`);
        await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${run.webUrl}/${locale}${suffix}`);
        const title = await page.title();
        await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', title);
        await expect(page.locator('head meta[name="twitter:title"]')).toHaveAttribute('content', title);
        await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
        const alt = await page.locator('head meta[property="og:image:alt"]').getAttribute('content');
        expect(alt?.length).toBeGreaterThan(10);
        await expect(page.locator('head meta[name="twitter:image:alt"]')).toHaveAttribute('content', alt!);
        const imageUrl = await page.locator('head meta[property="og:image"]').getAttribute('content');
        const image = await request.get(imageUrl!);
        expect(image.status()).toBe(200);
        expect(image.headers()['content-type']).toMatch(/^image\/(jpeg|webp)/);
        const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() || '{}');
        expect(data['@context']).toBe('https://schema.org');
        expect(data['@graph'].some((node: Record<string, unknown>) => node['@type'] === (suffix ? 'CreativeWork' : 'ProfilePage'))).toBe(true);
        expect(data['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'Person').name).toBe(locale === 'ru' ? 'Ульяна Непомилуева' : 'Uliana Nepomilueva');
      }
    }
  } finally { await context.close(); }
});

test('social JPEGs, icons, reciprocal sitemap and private-route index protection are available', async ({ request }) => {
  for (const name of ['portfolio-ru', 'portfolio-en', 'clypse-cover', 'fomina-cover']) {
    const response = await request.get(`/social/${name}-v1.jpg`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^image\/jpeg/);
    expect((await response.body()).length).toBeLessThan(200_000);
  }
  for (const path of ['/favicon.ico', '/icon.svg', '/icon-48.png', '/apple-touch-icon.png']) expect((await request.get(path)).status()).toBe(200);
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Allow: /api/media/');
  expect(robots).toContain('Disallow: /admin');
  expect(robots).toContain(`Sitemap: ${state().webUrl}/sitemap.xml`);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const locale of ['ru', 'en', 'x-default']) expect(sitemap).toContain(`hreflang="${locale}"`);
  expect(sitemap).not.toContain('/admin');
  expect(sitemap).not.toContain('/preview');
  const admin = await (await request.get('/admin')).text();
  expect(admin).toContain('noindex, nofollow, noarchive');
  const missing = await request.get('/de');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('noindex');
});
