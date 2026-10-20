import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const site = new URL(process.argv[2] || 'https://nepomiluu.art');
assert.ok(site.protocol === 'https:' || (site.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(site.hostname)), 'HTTPS or local HTTP required');
const reportPath = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
const get = path => fetch(new URL(path, site), { headers: { 'user-agent': 'TelegramBot (like TwitterBot)' }, signal: AbortSignal.timeout(20000) });
const decode = value => value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, entity => {
  if (entity.startsWith('&#')) return String.fromCodePoint(Number.parseInt(entity.slice(entity[2].toLowerCase() === 'x' ? 3 : 2, -1), entity[2].toLowerCase() === 'x' ? 16 : 10));
  return ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' })[entity.toLowerCase()];
});
function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name.toLowerCase(), decode(value)])));
}
function jpegSize(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'JPEG signature');
  let offset = 2;
  while (offset < bytes.length) {
    assert.equal(bytes[offset++], 0xff, 'JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    const length = bytes.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    offset += length;
  }
  throw new Error('Missing JPEG frame');
}

const manifest = JSON.parse(await readFile(new URL('../docs/social-assets-manifest.json', import.meta.url), 'utf8'));
const routesResponse = await get('/api/public/routes');
assert.equal(routesResponse.status, 200);
const routes = await routesResponse.json();
const pages = [], images = new Map();
for (const locale of ['ru', 'en']) {
  for (const suffix of ['', ...routes.map(route => `/projects/${route.slug}`)]) {
    const path = `/${locale}${suffix}`;
    const response = await get(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, new RegExp(`<html\\b[^>]*lang="${locale}"`));
    const head = html.split('</head>')[0];
    const meta = tags(head, 'meta'), links = tags(head, 'link');
    const field = name => meta.find(item => item.property === name || item.name === name)?.content;
    const title = decode(head.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
    assert.ok(title.length > 10, path);
    assert.equal(field('og:title'), title, path);
    assert.equal(field('twitter:title'), title, path);
    assert.ok(field('description')?.length > 20, path);
    assert.equal(field('og:description'), field('description'), path);
    assert.equal(field('twitter:description'), field('description'), path);
    assert.equal(field('og:url'), site.origin + path, path);
    assert.equal(links.find(item => item.rel === 'canonical')?.href, site.origin + path, path);
    for (const language of ['ru', 'en', 'x-default']) assert.equal(links.find(item => item.hreflang === language)?.href, `${site.origin}/${language === 'x-default' ? 'ru' : language}${suffix}`, path);
    assert.equal(field('robots'), 'index, follow', path);
    assert.equal(field('og:locale'), locale === 'ru' ? 'ru_RU' : 'en_US', path);
    assert.equal(field('twitter:card'), 'summary_large_image', path);
    const image = field('og:image');
    assert.equal(new URL(image).origin, site.origin, path);
    assert.equal(field('twitter:image'), image, path);
    assert.ok(field('og:image:alt')?.length > 10, path);
    assert.equal(field('twitter:image:alt'), field('og:image:alt'), path);
    const structured = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(([, value]) => JSON.parse(value));
    assert.equal(structured.length, 1, path);
    assert.equal(structured[0]['@context'], 'https://schema.org', path);
    assert.ok(structured[0]['@graph'].some(node => node['@type'] === (suffix ? 'CreativeWork' : 'ProfilePage')), path);
    images.set(image, field('og:image:type'));
    pages.push({ path, title, description: field('description'), image, locale: field('og:locale'), jsonLd: 'valid JSON' });
  }
}

const assets = [];
for (const [url, type] of images) {
  const response = await get(url);
  assert.equal(response.status, 200, url);
  assert.ok(response.headers.get('content-type')?.startsWith(type), url);
  const bytes = Buffer.from(await response.arrayBuffer());
  const pathname = new URL(url).pathname;
  const entry = manifest.files.find(file => file.output === `apps/web/public${pathname}`);
  if (entry) {
    assert.deepEqual(jpegSize(bytes), { width: 1200, height: 630 }, url);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, url);
  }
  assets.push({ url, bytes: bytes.length, type, ...(entry ? jpegSize(bytes) : {}) });
}
for (const path of ['/favicon.ico', '/icon.svg', '/icon-48.png', '/apple-touch-icon.png']) assert.equal((await get(path)).status, 200, path);
const robots = await (await get('/robots.txt')).text();
assert.ok(robots.includes('Allow: /api/media/') && robots.includes('Disallow: /admin') && robots.includes(`Sitemap: ${site.origin}/sitemap.xml`));
const sitemap = await (await get('/sitemap.xml')).text();
for (const language of ['ru', 'en', 'x-default']) assert.ok(sitemap.includes(`hreflang="${language}"`));
assert.ok(!sitemap.includes('/admin') && !sitemap.includes('/preview'));
const admin = await (await get('/admin')).text();
assert.match(admin, /noindex, nofollow, noarchive/);
const report = { site: site.origin, checkedAt: new Date().toISOString(), crawler: 'TelegramBot (like TwitterBot)', pages, assets, icons: '200 OK', robots: 'public media allowed; admin and API excluded', sitemap: 'matching RU/EN/x-default', admin: 'noindex', externalSocialPlatformCaches: 'not inspected' };
if (reportPath) { await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); }
console.log(`Social metadata verified over ${site.protocol}: ${pages.length} localized pages, ${assets.length} decoded images, initial HTML head, reciprocal alternates, JSON-LD, icons and private-route noindex.`);
