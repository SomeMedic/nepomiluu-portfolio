import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const target = process.argv[2];
if (!/^portfolio_restore_[a-z0-9_]{1,40}$/.test(target || '')) throw new Error('Refusing non-isolated database');
const uri = new URL(process.env.MONGODB_URI);
uri.pathname = `/${target}`;
const child = spawn(process.execPath, ['dist/main.js'], { cwd: '/app/apps/api', env: { ...process.env, MONGODB_URI: uri.toString(), MEDIA_DIR: '/restore-media', BACKUP_LOCK_FILE: '/tmp/restore-lock.json', API_HOST: '127.0.0.1', API_PORT: '4100' }, stdio: ['ignore', 'ignore', 'inherit'] });
let childError;
child.on('error', error => { childError = error; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (childError) throw childError;
    if (child.exitCode !== null) throw new Error('Restored API exited before readiness');
    try { const response = await fetch('http://127.0.0.1:4100/api/health', { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } } catch { /* Startup retries are bounded. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Restored API did not become healthy');
  const getJson = async path => {
    const response = await fetch(`http://127.0.0.1:4100${path}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Restored API smoke failed: ${path} (${response.status})`);
    return response.json();
  };
  const routes = await getJson('/api/public/routes');
  await getJson('/api/public/home');
  const publicMedia = new Set();
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.mediaId === 'string' && !value.mediaId.startsWith('builtin:')) publicMedia.add(value.mediaId);
    for (const child of Object.values(value)) if (typeof child === 'object') walk(child);
  };
  for (const route of routes) walk(await getJson(`/api/public/projects/${encodeURIComponent(route.slug)}`));
  const require = createRequire('/app/apps/api/package.json');
  const connection = await require('mongoose').createConnection(uri.toString()).asPromise();
  let media;
  try { media = await connection.db.collection('media').find({}, { projection: { _id: 1 } }).toArray(); }
  finally { await connection.close(); }
  for (const item of media) for (const variant of ['thumb', 'page', 'full']) {
    const response = await fetch(`http://127.0.0.1:4100/api/media/${encodeURIComponent(item._id)}/${variant}`, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (publicMedia.has(item._id)) {
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/webp') || Number(response.headers.get('content-length')) <= 0) throw new Error(`Restored public media unreadable: ${item._id}/${variant}`);
    } else if (response.status !== 404) throw new Error(`Restored private media leaked: ${item._id}/${variant}`);
  }
  process.stdout.write('Restored API health, public reads and media authorization passed.\n');
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
    await stopped;
    clearTimeout(timeout);
  }
}
