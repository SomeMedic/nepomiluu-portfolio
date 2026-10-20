import { afterAll, beforeAll, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from '../src/database.js';
import { readConfig } from '../src/config.js';

const execute = promisify(execFile);
let mongo: MongoMemoryServer;
let directory: string;
let db: Database;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  directory = await mkdtemp(join(tmpdir(), 'portfolio-seed-'));
  db = new Database({ ...readConfig({}), mongoUri: mongo.getUri() });
  await db.ready();
}, 120000);
afterAll(async () => {
  if (db) await db.onModuleDestroy();
  if (mongo) await mongo.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
});
it('bootstraps published homepage cases once and preserves owner edits and selection on repeat', async () => {
  const seed = () => execute(process.execPath, ['--import', 'tsx', 'apps/api/src/cli.ts', 'seed'], {
    cwd: process.cwd(), timeout: 20000,
    env: { ...process.env, TSX_TSCONFIG_PATH: join(process.cwd(), 'apps/api/tsconfig.json'), NODE_ENV: 'test', MONGODB_URI: mongo.getUri(), MEDIA_DIR: directory, BACKUP_LOCK_FILE: join(directory, '.backup-lock.json'), PUBLIC_ASSETS_DIR: join(process.cwd(), 'apps/web/public/assets') },
  });
  expect((await seed()).stdout).toContain('2 projects inserted');
  const first = await db.projects.findOne({ slug: 'clypse' }).lean();
  const second = await db.projects.findOne({ slug: 'fomina' }).lean();
  expect(first?.publishedSnapshot).toBeTruthy();
  expect(second?.publishedSnapshot).toBeTruthy();
  expect(await db.home.findById('home').lean()).toMatchObject({ first: first!._id, second: second!._id });
  await db.projects.updateOne({ _id: first!._id }, { $set: { 'draft.title.ru': 'Saved owner draft' } });
  await db.home.updateOne({ _id: 'home' }, { $set: { first: second!._id, second: first!._id } });
  expect((await seed()).stdout).toContain('0 projects inserted');
  expect((await db.projects.findById(first!._id).lean())?.draft.title.ru).toBe('Saved owner draft');
  expect(await db.home.findById('home').lean()).toMatchObject({ first: second!._id, second: first!._id });
});
