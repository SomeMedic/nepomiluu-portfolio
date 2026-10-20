import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { copyFile, cp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// This harness never reads a .env or connects to an inherited MongoDB URI.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runDir = process.env.PORTFOLIO_E2E_RUN_DIR;
if (!runDir || !path.isAbsolute(runDir)) throw new Error('Playwright must supply an absolute temporary run directory');
const relativeRunDir = path.relative(path.resolve(tmpdir()), path.resolve(runDir));
if (!relativeRunDir || relativeRunDir.startsWith('..') || path.isAbsolute(relativeRunDir)) throw new Error('E2E credentials and media must stay in an operating-system temporary directory');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const webRequire = createRequire(path.join(root, 'apps/web/package.json'));
const { MongoMemoryServer } = apiRequire('mongodb-memory-server');
const argon2 = apiRequire('argon2');
const next = webRequire('next');
const { fixtureContent } = await import('../tests/e2e/fixture-content.ts');
const { createApp } = await import('../apps/api/src/app.ts');
const { Database } = await import('../apps/api/src/database.ts');
const { passwordOptions } = await import('../apps/api/src/auth.ts');
const apiUrl = 'http://127.0.0.1:4100';
const webUrl = 'http://127.0.0.1:3100';
const runId = randomBytes(5).toString('hex');
const email = `browser-${runId}@example.invalid`;
const password = randomBytes(32).toString('base64url');
const internalSecret = randomBytes(32).toString('hex');
const workDir = path.join(root, '.cache', `e2e-web-${runId}`);
const sourceWeb = path.join(root, 'apps/web');
let mongo, api, web, server;
const sockets = new Set();
let cleanupPromise;
function cleanup() {
  cleanupPromise ||= (async () => {
    const failures = [];
    const closed = server ? new Promise(resolve => server.close(resolve)) : Promise.resolve();
    for (const socket of sockets) socket.destroy();
    await closed;
    for (const close of [() => web?.close(), () => api?.close(), () => mongo?.stop()]) {
      try { await close(); } catch (error) { failures.push(error); }
    }
    process.chdir(root);
    // The resolved cache is one unique child of this workspace's .cache directory.
    if (path.dirname(workDir) === path.join(root, '.cache')) {
      // Next's final type-generation writes may briefly outlive close() on Windows.
      try { await rm(workDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, 'Isolated harness cleanup failed');
    await writeFile(path.join(runDir, 'shutdown-complete'), 'ok');
  })();
  return cleanupPromise;
}
function shutdown() {
  void cleanup().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
}
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, shutdown);
try {
  await mkdir(runDir, { recursive: true });
  mongo = await MongoMemoryServer.create({ instance: { dbName: `browser_${runId}` } });
  Object.assign(process.env, {
    NODE_ENV: 'development', MONGODB_URI: mongo.getUri(), API_INTERNAL_URL: apiUrl,
    PUBLIC_ORIGIN: webUrl, SITE_URL: webUrl, WEB_INTERNAL_URL: webUrl,
    INTERNAL_SECRET: internalSecret, ALLOW_STATIC_CONTENT: 'false', NEXT_TELEMETRY_DISABLED: '1',
  });
  const mediaDir = path.join(runDir, 'media');
  api = await createApp({ mongoUri: mongo.getUri(), port: 4100, host: '127.0.0.1', production: false, sessionHours: 1, mediaDir, backupLockFile: path.join(mediaDir, '.backup-lock.json'), publicAssetsDir: path.join(root, 'apps/web/public/assets'), publicOrigin: webUrl, webInternalUrl: webUrl, internalSecret }, false);
  await api.get(Database).owners.create({ _id: 'owner', email, passwordHash: await argon2.hash(password, passwordOptions), updatedAt: new Date() });
  await api.listen(4100, '127.0.0.1');
  const login = await fetch(`${apiUrl}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!login.ok) throw new Error(`Fixture login failed (${login.status})`);
  const { csrfToken } = await login.json();
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  async function admin(route, method, data) {
    const response = await fetch(`${apiUrl}/api/admin${route}`, { method, headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrfToken }, body: JSON.stringify(data) });
    if (!response.ok) throw new Error(`Fixture ${method} ${route} failed (${response.status})`);
    return response.json();
  }
  const fixtures = [];
  for (const index of [1, 2]) {
    const project = await admin('/projects', 'POST', { slug: `browser-${runId}-${index}`, draft: fixtureContent(`Проверка ${index}`, `Browser fixture ${index}`) });
    fixtures.push(await admin(`/projects/${project.id}/publish`, 'POST', { revision: project.revision }));
  }
  await admin('/home', 'PUT', { first: fixtures[0].id, second: fixtures[1].id });
  await writeFile(path.join(runDir, 'state.json'), JSON.stringify({ email, password, apiUrl, webUrl, runId, shutdownSecret: internalSecret, fixtures: fixtures.map(({ id, slug }) => ({ id, slug })) }), { mode: 0o600 });
  // Next also locks by application directory, independently of distDir. A disposable
  // app directory with a source snapshot allows the normal dev server to keep running.
  await mkdir(workDir, { recursive: true });
  await cp(path.join(sourceWeb, 'src'), path.join(workDir, 'src'), { recursive: true });
  for (const directory of ['public', 'node_modules']) await symlink(path.join(sourceWeb, directory), path.join(workDir, directory), process.platform === 'win32' ? 'junction' : 'dir');
  for (const filename of ['package.json', 'postcss.config.mjs', 'next.config.ts']) await copyFile(path.join(sourceWeb, filename), path.join(workDir, filename));
  const tsconfig = JSON.parse(await readFile(path.join(sourceWeb, 'tsconfig.json'), 'utf8'));
  tsconfig.extends = path.join(root, 'tsconfig.base.json');
  await writeFile(path.join(workDir, 'tsconfig.json'), JSON.stringify(tsconfig));
  await writeFile(path.join(workDir, 'next-env.d.ts'), '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
  process.chdir(workDir);
  const importedConfig = await import('../apps/web/next.config.ts');
  // tsx exposes a CJS-transformed TypeScript config through an extra default layer.
  const config = importedConfig.default.default || importedConfig.default;
  web = next({ dev: true, dir: workDir, hostname: '127.0.0.1', port: 3100, conf: { ...config, distDir: '.next', outputFileTracingRoot: root }, webpack: true });
  await web.prepare();
  const handle = web.getRequestHandler();
  server = createServer((request, response) => {
    // Playwright cannot send graceful process signals on Windows. This private,
    // harness-only handshake lets teardown remove its cache and stop MongoDB.
    if (request.url === '/__portfolio_e2e/shutdown' && request.method === 'POST' && request.headers['x-e2e-secret'] === internalSecret) {
      response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"ok":true}');
      setTimeout(shutdown, 50);
      return;
    }
    void handle(request, response);
  });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(3100, '127.0.0.1', resolve); });
  console.log(`Isolated browser harness ready. Evidence: ${path.join(runDir, 'evidence')}`);
} catch (error) {
  console.error(error);
  await cleanup();
  process.exitCode = 1;
}
