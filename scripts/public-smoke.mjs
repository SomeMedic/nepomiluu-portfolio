import assert from 'node:assert/strict';
const origin = new URL(process.argv[2] || 'https://nepomiluu.art');
assert.equal(origin.protocol, 'https:');
const read = async (path, options = {}) => {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(20000), ...options });
  return { response, body: options.method === 'HEAD' ? '' : await response.text() };
};
const pages = [];
const routesResult = await read('/api/public/routes');
assert.equal(routesResult.response.status, 200);
const routes = JSON.parse(routesResult.body);
assert.ok(Array.isArray(routes) && routes.length > 0, 'Published cases');
for (const locale of ['ru', 'en']) {
  for (const suffix of ['', ...routes.map(route => `/projects/${encodeURIComponent(route.slug)}`)]) {
    const path = `/${locale}${suffix}`;
    const { response, body } = await read(path);
    assert.equal(response.status, 200, path);
    assert.ok(body.includes(origin.origin + path), `Canonical ${path}`);
    pages.push(body);
  }
}
const health = await read('/api/health');
assert.equal(health.response.status, 200);
const home = await read('/api/public/home');
assert.equal(home.response.status, 200);
const selection = JSON.parse(home.body);
for (const slot of ['first', 'second']) assert.ok(routes.some(route => route.slug === selection[slot]?.slug), `Published homepage slot: ${slot}`);
for (const path of ['/api/internal/backup/lock', '/api/internal/revalidate']) {
  assert.equal((await read(path)).response.status, 404, path);
}
assert.equal((await read('/api/admin/session')).response.status, 401);
const admin = await read('/admin');
assert.equal(admin.response.status, 200);
assert.ok(/noindex/.test(admin.body), 'Admin must not be indexed');
for (const path of ['/robots.txt', '/sitemap.xml']) {
  const result = await read(path);
  assert.equal(result.response.status, 200, path);
  assert.ok(result.body.includes(origin.origin), `Runtime origin ${path}`);
}
const assets = new Set(pages.join('').match(/\/_next\/static\/[^"\s<>]+?\.(?:css|js)/g) || []);
assert.ok(assets.size > 0);
for (const path of assets) assert.equal((await read(path, { method: 'HEAD' })).response.status, 200, path);
for (const path of ['/fonts/fonts.css', '/assets/clypse-cover.webp', '/assets/fomina-cover.webp', '/Uliana_Nepomilueva_UX_UI_Product_Designer_CV.pdf']) {
  assert.equal((await read(path, { method: 'HEAD' })).response.status, 200, path);
}
console.log(`HTTPS smoke passed: RU/EN home and ${routes.length} cases, selected projects, admin isolation, SEO, ${assets.size} bundles and public assets.`);
