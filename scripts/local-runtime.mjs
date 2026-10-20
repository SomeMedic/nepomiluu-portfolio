import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function developmentEnvironment({ projectRoot = root, required = false, inherited = process.env } = {}) {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24 LTS to run this workspace');
  const envFile = join(projectRoot, '.env');
  if (required && !existsSync(envFile)) throw new Error('Local CLI requires the repository .env; copy .env.example and configure its MONGODB_URI first');
  const configured = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
  if (required && !/^mongodb(?:\+srv)?:\/\//.test(configured.MONGODB_URI || '')) throw new Error('Local CLI requires an explicit MONGODB_URI in the repository .env; inherited URIs are refused');
  const env = { ...inherited };
  for (const [key, value] of Object.entries(configured)) {
    for (const inheritedKey of Object.keys(env)) if (inheritedKey.toLowerCase() === key.toLowerCase()) delete env[inheritedKey];
    env[key] = value;
  }
  if (env.NODE_ENV === 'production') throw new Error('Local scripts require a development environment; use the documented container CLI for production');
  env.NODE_ENV = 'development';
  env.NEXT_TELEMETRY_DISABLED = '1';
  const pathKeys = Object.keys(env).filter(key => key.toLowerCase() === 'path');
  const inheritedPath = pathKeys.map(key => env[key]).find(Boolean) || '';
  for (const key of pathKeys) delete env[key];
  env.PATH = `${dirname(process.execPath)}${delimiter}${inheritedPath}`;
  env.MEDIA_DIR = resolve(projectRoot, env.MEDIA_DIR || '.data/media');
  env.PUBLIC_ASSETS_DIR = resolve(projectRoot, 'apps/web/public/assets');
  env.PUBLIC_ORIGIN ||= 'http://localhost:3000';
  env.API_INTERNAL_URL ||= 'http://127.0.0.1:4000';
  env.WEB_INTERNAL_URL ||= 'http://127.0.0.1:3000';
  env.API_HOST ||= '127.0.0.1';
  env.API_PORT ||= '4000';
  env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/portfolio';
  if (!env.INTERNAL_SECRET || env.INTERNAL_SECRET.startsWith('replace-')) env.INTERNAL_SECRET = randomBytes(32).toString('hex');
  env.ALLOW_STATIC_CONTENT = env.ALLOW_STATIC_CONTENT === 'true' ? 'true' : 'false';
  return { env, envFile };
}

export function pnpmCli(env) {
  const candidates = env.PNPM_CLI_PATH ? [resolve(env.PNPM_CLI_PATH)] : (env.PATH || '').split(delimiter).flatMap(directory => {
    const direct = join(directory, 'node_modules/pnpm/bin/pnpm.cjs');
    const executable = join(directory, 'pnpm');
    const result = [direct];
    if (process.platform !== 'win32' && existsSync(executable)) {
      try { result.push(realpathSync(executable)); } catch { /* Next path candidate. */ }
    }
    return result;
  });
  const found = candidates.find(path => existsSync(path));
  if (!found) throw new Error('pnpm CLI not found. Install pnpm 10.20.0 or set PNPM_CLI_PATH to pnpm/bin/pnpm.cjs');
  return found;
}

export function startPnpm(pnpm, args, env) {
  const child = spawn(process.execPath, [pnpm, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  const stop = () => child.kill('SIGTERM');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); process.exitCode = code ?? (signal ? 1 : 0); });
  return child;
}
