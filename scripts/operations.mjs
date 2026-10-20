import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, readdir, lstat, readFile, realpath, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const id = () => `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${randomBytes(4).toString('hex')}`;
export function options(args) {
  const output = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--smoke') output.smoke = true;
    else if (['--env-file', '--output-dir', '--bundle', '--database', '--restore-root'].includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) output[arg.slice(2)] = args[++i];
    else throw new Error(`Unknown or incomplete option: ${arg}`);
  }
  return output;
}
export async function run(command, args, { input, outputFile, timeout = 120000, maxBytes = 64 * 1024 * 1024, env = process.env } = {}) {
  const child = spawn(command, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  child.stdin.on('error', () => {}); // A rejected command may close stdin early.
  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);
  let processError;
  const timer = setTimeout(() => { processError = new Error(`${command} exceeded its bounded timeout`); child.kill('SIGKILL'); }, timeout);
  child.stderr.on('data', chunk => { if (stderr.length < 65536) stderr = Buffer.concat([stderr, chunk]); });
  const completion = new Promise((resolvePromise, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 && !processError ? resolvePromise() : reject(processError || new Error(`${command} failed (${code}): ${stderr.toString().slice(-3000).replace(/mongodb(?:\+srv)?:\/\/[^:/\s]+:[^@\s]+@/g, 'mongodb://[redacted]@')}`)));
  });
  completion.catch(() => {});
  if (!outputFile) child.stdout.on('data', chunk => { stdout = Buffer.concat([stdout, chunk]); if (stdout.length > maxBytes) { processError = new Error('Command output exceeded limit'); child.kill('SIGKILL'); } });
  const transfer = outputFile ? pipeline(child.stdout, createWriteStream(outputFile, { flags: 'wx', mode: 0o600 })) : Promise.resolve();
  let feed = Promise.resolve();
  if (input && typeof input !== 'string' && !Buffer.isBuffer(input)) feed = pipeline(input, child.stdin);
  else child.stdin.end(input);
  try { await Promise.all([completion, transfer, feed]); return stdout.toString(); }
  catch (error) { child.kill('SIGKILL'); await completion.catch(() => {}); throw error; }
  finally { clearTimeout(timer); }
}
export async function composeFor(envFile, { overrides = [] } = {}) {
  if (!envFile || !isAbsolute(envFile)) throw new Error('--env-file must be an absolute path outside this checkout');
  const actual = await realpath(envFile);
  const inside = relative(root, actual);
  if (!inside.startsWith(`..${sep}`) && inside !== '..' && !isAbsolute(inside)) throw new Error('Production secrets must be outside the checkout');
  const files = [join(root, 'compose.yaml'), ...overrides.map(path => resolve(root, path))];
  const prefix = ['compose', '--project-directory', root, '--env-file', actual, ...files.flatMap(path => ['-f', path])];
  // An inherited URI from another project must never override this explicitly
  // selected deployment file through Compose's shell-variable precedence.
  const env = { ...process.env };
  const template = (await Promise.all(files.map(path => readFile(path, 'utf8')))).join('\n');
  const variables = new Set([...template.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)].map(match => match[1]));
  for (const key of Object.keys(env)) if (variables.has(key.toUpperCase())) delete env[key];
  const exec = (args, settings) => run(process.platform === 'win32' ? 'docker.exe' : 'docker', [...prefix, ...args], { ...settings, env });
  const config = JSON.parse(await exec(['config', '--format', 'json']));
  const db = config.services.mongo.environment.MONGO_INITDB_DATABASE;
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(db)) throw new Error('Unsafe source database name');
  const actualDb = new URL(config.services.api.environment.MONGODB_URI).pathname.slice(1);
  if (actualDb !== db) throw new Error('MONGO_DB and database in MONGODB_URI must match');
  return { exec, config, db };
}
export async function filesUnder(directory, prefix = '') {
  const result = [];
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name);
    const stat = await lstat(path);
    const key = prefix ? `${prefix}/${name}` : name;
    if (stat.isSymbolicLink()) throw new Error(`Symlink in backup tree: ${key}`);
    if (stat.isDirectory()) result.push(...await filesUnder(path, key));
    else if (stat.isFile()) result.push(key);
    else throw new Error(`Unsupported backup file: ${key}`);
  }
  return result;
}
export async function sha256(path) { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); }
export async function fileManifest(directory) {
  const result = {};
  for (const path of await filesUnder(directory)) if (path !== 'manifest.json') result[path] = { sha256: await sha256(join(directory, path)), bytes: (await lstat(join(directory, path))).size };
  return result;
}
export async function verifyManifest(directory, manifest) {
  if (manifest.format !== 1 || !manifest.files || !manifest.sourceDatabase) throw new Error('Unsupported or incomplete backup manifest');
  const actual = await fileManifest(directory);
  if (JSON.stringify(Object.keys(actual).sort()) !== JSON.stringify(Object.keys(manifest.files).sort())) throw new Error('Backup file list differs from manifest');
  for (const [path, file] of Object.entries(actual)) if (file.sha256 !== manifest.files[path].sha256 || file.bytes !== manifest.files[path].bytes) throw new Error(`Backup checksum/size mismatch: ${path}`);
}
export function checkArchiveNames(names, verbose = '') {
  for (const line of verbose.trim().split(/\r?\n/)) if (line && !['-', 'd'].includes(line[0])) throw new Error('Archive contains links or unsupported entries');
  const seen = new Set();
  for (let name of names.trim().split(/\r?\n/)) {
    name = name.replace(/^\.\//, '').replace(/\/$/, '');
    if (!name) continue;
    const allowed = /^(manifest\.json|inventory\.json|database\.archive\.gz|media|media\/[a-f0-9-]{36}|media\/[a-f0-9-]{36}\/(thumb|page|full)\.webp)$/;
    if (!allowed.test(name) || seen.has(name)) throw new Error(`Unsafe or duplicate archive path: ${name}`);
    seen.add(name);
  }
  for (const required of ['manifest.json', 'inventory.json', 'database.archive.gz']) if (!seen.has(required)) throw new Error(`Archive missing ${required}`);
}
export async function verifyReferences(inventory, mediaDir) {
  for (const path of await filesUnder(mediaDir)) if (!/^[a-f0-9-]{36}\/(thumb|page|full)\.webp$/.test(path)) throw new Error(`Unexpected media file: ${path}`);
  const rows = new Set(inventory.media.map(item => item._id));
  const builtin = new Set(inventory.builtinFiles);
  const referenced = new Set();
  let localizedPairs = 0;
  const walk = async (value, path, published) => {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'ru') || Object.hasOwn(value, 'en')) {
      if (typeof value.ru !== 'string' || typeof value.en !== 'string') throw new Error(`Missing RU/EN pair: ${path}`);
      localizedPairs++;
    }
    if (Object.hasOwn(value, 'mediaId')) {
      const mediaId = value.mediaId;
      if (typeof value.alt?.ru !== 'string' || typeof value.alt?.en !== 'string') throw new Error(`Missing RU/EN image alt: ${path}`);
      if (published && (!value.alt.ru.trim() || !value.alt.en.trim())) throw new Error(`Empty published image alt: ${path}`);
      referenced.add(mediaId);
      if (mediaId.startsWith('builtin:')) { if (!builtin.has(mediaId)) throw new Error(`Missing builtin media: ${mediaId}`); }
      else if (!/^[a-f0-9-]{36}$/.test(mediaId) || !rows.has(mediaId)) throw new Error(`Missing media DB row: ${mediaId}`);
    }
    for (const [key, child] of Object.entries(value)) if (typeof child === 'object') await walk(child, `${path}.${key}`, published);
  };
  for (const project of inventory.projects) {
    await walk(project.draft, `${project.slug}.draft`, false);
    if (project.publishedSnapshot) {
      for (const field of ['title', 'summary', 'category', 'role', 'period', 'status', 'seoTitle', 'seoDescription']) for (const locale of ['ru', 'en']) if (!project.publishedSnapshot[field]?.[locale]?.trim()) throw new Error(`Incomplete published ${project.slug}.${field}.${locale}`);
      await walk(project.publishedSnapshot, `${project.slug}.publishedSnapshot`, true);
    }
  }
  for (const mediaId of rows) {
    if (!/^[a-f0-9-]{36}$/.test(mediaId)) throw new Error(`Unsafe media ID: ${mediaId}`);
    for (const variant of ['thumb', 'page', 'full']) {
      const path = join(mediaDir, mediaId, `${variant}.webp`);
      await access(path);
      if ((await lstat(path)).size <= 0) throw new Error(`Empty media file: ${mediaId}/${variant}`);
    }
  }
  for (const home of inventory.homes) for (const slot of ['first', 'second']) if (home[slot] && !inventory.projects.some(project => project._id === home[slot] && project.publishedSnapshot)) throw new Error(`Home ${slot} references an unpublished/missing project`);
  return { projects: inventory.projects.length, published: inventory.projects.filter(project => project.publishedSnapshot).length, referencedMedia: referenced.size, storedMedia: rows.size, localizedPairs, locales: ['ru', 'en'] };
}
export function comparableInventory(value) { return { projects: value.projects, media: value.media, homes: value.homes, ownerCount: value.ownerCount, builtinFiles: value.builtinFiles }; }
export async function removeOwnedTemporary(path, parent) {
  const rel = relative(resolve(parent), resolve(path));
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || !rel.startsWith('.portfolio-')) throw new Error('Refusing unsafe temporary-directory removal');
  await rm(path, { recursive: true, force: true });
}
export async function ensureNewDirectory(path) { await mkdir(dirname(path), { recursive: true, mode: 0o700 }); await mkdir(path, { mode: 0o700 }); }
export function reportError(error) { console.error(error.message); process.exitCode = 1; }
