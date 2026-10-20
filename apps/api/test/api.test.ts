import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import sharp from 'sharp';
import { emptyContent, type ProjectContent } from '@portfolio/contracts';
import { createApp } from '../src/app.js';
import { Database } from '../src/database.js';
import { passwordOptions } from '../src/auth.js';
import { readConfig } from '../src/config.js';
import { MutationGate } from '../src/mutation-gate.js';
const password = 'integration-password-123';
function localized(value = 'Complete copy') { return { ru: value, en: value }; }
function completeContent(): ProjectContent {
  const content = emptyContent();
  for (const key of ['title', 'summary', 'category', 'role', 'period', 'status', 'seoTitle', 'seoDescription'] as const) content[key] = localized(key);
  content.cover = { mediaId: 'builtin:fomina-home', alt: localized('Home screen') };
  content.blocks = [{ id: 'intro', type: 'text', title: localized('Title'), body: localized('Case body') }];
  content.home = { headline: localized('Headline'), subline: localized('Subline'), stages: [0, 1, 2].map(index => ({ label: localized(`Stage${index}`), title: localized('Title'), body: localized('Description'), image: { mediaId: 'builtin:fomina-home', alt: localized('Stage image') }, annotations: [] })) };
  return content;
}
let mongo: MongoMemoryServer; let directory: string; let app: INestApplication; let db: Database; let base: string; let cookie: string; let csrf: string;
async function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/api${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-csrf-token': csrf } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
}
async function create(slug = 'first-project', draft = completeContent()) { const response = await request('/admin/projects', 'POST', { slug, draft }); expect(response.status).toBe(201); return response.json(); }
async function publish(project: { id: string; revision: number }) { const response = await request(`/admin/projects/${project.id}/publish`, 'POST', { revision: project.revision }); expect(response.status).toBe(200); return response.json(); }
beforeAll(async () => {
  mongo = await MongoMemoryServer.create(); directory = await mkdtemp(join(tmpdir(), 'portfolio-api-'));
  app = await createApp({ ...readConfig({}), mongoUri: mongo.getUri(), mediaDir: directory, publicAssetsDir: join(process.cwd(), 'apps/web/public/assets'), backupLockFile: join(directory, '.backup-lock.json'), internalSecret: 'internal-test-secret-32-characters', webInternalUrl: 'http://127.0.0.1:1' }, false);
  await app.listen(0, '127.0.0.1'); base = await app.getUrl(); db = app.get(Database);
  await db.owners.create({ _id: 'owner', email: 'owner@example.test', passwordHash: await argon2.hash(password, passwordOptions), updatedAt: new Date() });
}, 120000);
beforeEach(async () => {
  cookie = ''; csrf = '';
  const login = await request('/admin/login', 'POST', { email: 'owner@example.test', password });
  expect(login.status).toBe(200);
  expect(login.headers.get('set-cookie')).toContain('HttpOnly');
  expect(login.headers.get('set-cookie')).toContain('SameSite=Strict');
  cookie = login.headers.get('set-cookie')!.split(';')[0]!; csrf = (await login.json()).csrfToken;
  await Promise.all([db.projects.deleteMany({}), db.home.deleteMany({}), db.media.deleteMany({})]);
});
afterAll(async () => { if (app) await app.close(); if (mongo) await mongo.stop(); if (directory) await rm(directory, { recursive: true, force: true }); });
describe('owner session boundary', () => {
  it('requires authentication, rotates cookie, checks CSRF and clears logout', async () => {
    expect((await fetch(`${base}/api/admin/projects`)).status).toBe(401);
    expect((await fetch(`${base}/api/ADMIN/projects`)).status).toBe(401);
    const session = await request('/admin/session'); expect((await session.json()).csrfToken).toBe(csrf);
    expect((await request('/admin/projects', 'POST', { slug: 'bad-csrf', draft: completeContent() }, { 'x-csrf-token': 'wrong' })).status).toBe(403);
    expect((await request('/admin/projects', 'POST', { slug: 'bad-origin', draft: completeContent() }, { origin: 'https://attacker.test' })).status).toBe(403);
    expect((await request('/admin/logout', 'POST')).status).toBe(200);
    expect((await request('/admin/session')).status).toBe(401);
  });
});
describe('draft and publication separation', () => {
  it('keeps drafts out of public responses and preserves published snapshots during edits', async () => {
    let project = await create();
    expect((await fetch(`${base}/api/public/projects/${project.slug}`)).status).toBe(404);
    expect(await (await fetch(`${base}/api/public/routes`)).json()).toEqual([]);
    project = await publish(project);
    const draft = completeContent(); draft.title = localized('Unpublished edit');
    const saved = await request(`/admin/projects/${project.id}`, 'PATCH', { slug: project.slug, revision: project.revision, draft }); expect(saved.status).toBe(200);
    const publicProject = await (await fetch(`${base}/api/public/projects/${project.slug}`)).json(); expect(publicProject.content.title.en).toBe('title'); expect(publicProject.draft).toBeUndefined();
    const preview = await (await request(`/admin/projects/${project.id}/preview`)).json(); expect(preview.content.title.en).toBe('Unpublished edit');
    expect((await request(`/admin/projects/${project.id}`, 'PATCH', { slug: project.slug, revision: project.revision, draft })).status).toBe(409);
    const current = await saved.json(); expect((await request(`/admin/projects/${project.id}`, 'PATCH', { slug: 'changed-slug', revision: current.revision, draft })).status).toBe(409);
  });
  it('rejects missing translations and missing media when publishing', async () => {
    const incomplete = completeContent(); incomplete.title.en = '';
    const project = await create('incomplete-case', incomplete);
    expect((await request(`/admin/projects/${project.id}/publish`, 'POST', { revision: 0 })).status).toBe(400);
    const missing = completeContent(); missing.cover!.mediaId = 'unknown-media';
    const other = await create('missing-media', missing);
    expect((await request(`/admin/projects/${other.id}/publish`, 'POST', { revision: 0 })).status).toBe(400);
  });
  it('commits only one of two concurrent saves from the same revision', async () => {
    const project = await create('concurrent-edit');
    const first = completeContent(); first.title = localized('First writer');
    const second = completeContent(); second.title = localized('Second writer');
    const results = await Promise.all([
      request(`/admin/projects/${project.id}`, 'PATCH', { slug: project.slug, revision: 0, draft: first }),
      request(`/admin/projects/${project.id}`, 'PATCH', { slug: project.slug, revision: 0, draft: second }),
    ]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const current = await (await request(`/admin/projects/${project.id}`)).json();
    expect(current.revision).toBe(1);
    expect(['First writer', 'Second writer']).toContain(current.draft.title.en);
  });
  it('requires three stages and prevents deleting or unpublishing homepage selections', async () => {
    const first = await publish(await create('first-case'));
    const second = await publish(await create('second-case'));
    expect((await request('/admin/home', 'PUT', { first: first.id, second: second.id })).status).toBe(200);
    const home = await (await fetch(`${base}/api/public/home`)).json(); expect(home.first.slug).toBe('first-case');
    expect((await request(`/admin/projects/${first.id}/unpublish`, 'POST', { revision: first.revision })).status).toBe(409);
    expect((await request(`/admin/projects/${second.id}?revision=${second.revision}`, 'DELETE')).status).toBe(409);
    const content = completeContent(); content.home.stages = [];
    const third = await publish(await create('third-case', content));
    expect((await request('/admin/home', 'PUT', { first: third.id, second: second.id })).status).toBe(400);
  });
  it('preserves the published homepage snapshot when an incomplete replacement is rejected', async () => {
    const first = await publish(await create('home-original'));
    const second = await publish(await create('home-secondary'));
    expect((await request('/admin/home', 'PUT', { first: first.id, second: second.id })).status).toBe(200);
    const incomplete = completeContent(); incomplete.title = localized('Draft replacement'); incomplete.home.stages = [];
    const saved = await (await request(`/admin/projects/${first.id}`, 'PATCH', { slug: first.slug, revision: first.revision, draft: incomplete })).json();
    expect((await request(`/admin/projects/${first.id}/publish`, 'POST', { revision: saved.revision })).status).toBe(400);
    const home = await (await fetch(`${base}/api/public/home`)).json();
    expect(home.first.content.title.en).toBe('title'); expect(home.first.content.home.stages).toHaveLength(3);
    const current = await (await request(`/admin/projects/${first.id}`)).json(); expect(current.revision).toBe(saved.revision);
  });
  it('keeps homepage selection and publication consistent under concurrent writes', async () => {
    for (let index = 0; index < 2; index++) {
      const first = await publish(await create(`racing-first-${index}`));
      const second = await publish(await create(`racing-second-${index}`));
      const select = () => request('/admin/home', 'PUT', { first: first.id, second: second.id });
      const unpublish = () => request(`/admin/projects/${first.id}/unpublish`, 'POST', { revision: first.revision });
      const responses = await Promise.all(index === 0 ? [select(), unpublish()] : [unpublish(), select()]);
      expect(responses.some(response => response.ok)).toBe(true);
      expect(responses.some(response => [400, 409].includes(response.status))).toBe(true);
      const selection = await (await request('/admin/home')).json();
      for (const id of [selection.first, selection.second].filter(Boolean)) {
        const selected = await (await request(`/admin/projects/${id}`)).json(); expect(selected.publishedSnapshot).not.toBeNull();
      }
    }
  });
});
describe('private uploads and backup lease', () => {
  it('validates actual image bytes and only exposes media referenced by a published snapshot', async () => {
    const imageBytes = new Uint8Array(await sharp({ create: { width: 20, height: 12, channels: 3, background: '#ffffff' } }).png().toBuffer());
    const form = new FormData(); form.set('file', new Blob([imageBytes], { type: 'image/png' }), 'test.png');
    const upload = await fetch(`${base}/api/admin/media`, { method: 'POST', body: form, headers: { cookie, 'x-csrf-token': csrf } }); expect(upload.status).toBe(201); const media = await upload.json();
    expect((await fetch(`${base}${media.url}`)).status).toBe(404); expect((await fetch(`${base}${media.url}`, { headers: { cookie } })).status).toBe(200);
    const draft = completeContent(); draft.cover!.mediaId = media.id; let project = await create('uploaded-case', draft);
    expect((await fetch(`${base}${media.url}`)).status).toBe(404); project = await publish(project);
    expect((await fetch(`${base}${media.url}`)).status).toBe(200);
    expect((await request(`/admin/projects/${project.id}/unpublish`, 'POST', { revision: project.revision })).status).toBe(200);
    expect((await fetch(`${base}${media.url}`)).status).toBe(404);
    const invalid = new FormData(); invalid.set('file', new Blob(['<svg/>'], { type: 'image/png' }), 'pretend.png');
    expect((await fetch(`${base}/api/admin/media`, { method: 'POST', body: invalid, headers: { cookie, 'x-csrf-token': csrf } })).status).toBe(400);
  });
  it('uses published references for media visibility and rejects missing derivative files', async () => {
    const bytes = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).avif().toBuffer());
    const form = new FormData(); form.set('file', new Blob([bytes], { type: 'image/avif' }), 'test.avif');
    const uploaded = await fetch(`${base}/api/admin/media`, { method: 'POST', body: form, headers: { cookie, 'x-csrf-token': csrf } });
    expect(uploaded.status).toBe(201); const media = await uploaded.json();
    const draft = completeContent(); draft.cover!.mediaId = media.id;
    const project = await publish(await create('media-snapshot', draft));
    const saved = await (await request(`/admin/projects/${project.id}`, 'PATCH', { slug: project.slug, revision: project.revision, draft: completeContent() })).json();
    expect((await fetch(`${base}${media.url}`)).status).toBe(200);
    await publish(saved);
    expect((await fetch(`${base}${media.url}`)).status).toBe(404);
    expect((await fetch(`${base}/api/media/${media.id}/original`, { headers: { cookie } })).status).toBe(404);
    await rm(join(directory, media.id, 'page.webp'));
    const broken = await create('missing-derivative', draft);
    expect((await request(`/admin/projects/${broken.id}/publish`, 'POST', { revision: broken.revision })).status).toBe(400);
    expect((await fetch(`${base}/api/public/projects/${broken.slug}`)).status).toBe(404);
  });
  it('enforces the upload size before decoding or storing the file', async () => {
    const form = new FormData(); form.set('file', new Blob([new Uint8Array(20 * 1024 * 1024 + 1)], { type: 'image/png' }), 'oversized.png');
    const uploaded = await fetch(`${base}/api/admin/media`, { method: 'POST', body: form, headers: { cookie, 'x-csrf-token': csrf } });
    expect(uploaded.status).toBe(413); expect(await db.media.countDocuments()).toBe(0);
  });
  it('drains writes, persists a bounded lock, blocks mutations and verifies unlock tokens', async () => {
    expect((await request('/internal/backup/lock', 'POST', {})).status).toBe(401);
    const gate = app.get(MutationGate); let finish!: () => void;
    const admitted = gate.mutate(() => new Promise<void>(resolve => { finish = resolve; }));
    await new Promise(resolve => setTimeout(resolve, 20));
    let lockReturned = false;
    const pending = gate.acquire(300).then(lock => { lockReturned = true; return lock; });
    await new Promise(resolve => setTimeout(resolve, 20)); expect(lockReturned).toBe(false); finish(); await admitted;
    const lock = await pending; expect(lock.activeMutations).toBe(0);
    expect((await request('/admin/projects', 'POST', { slug: 'locked-case', draft: completeContent() })).status).toBe(503);
    const fresh = new MutationGate({ ...readConfig({}), backupLockFile: join(directory, '.backup-lock.json') }); expect((await fresh.status()).locked).toBe(true);
    expect((await request('/internal/backup/unlock', 'POST', { token: '00000000-0000-4000-8000-000000000000' }, { 'x-internal-secret': 'internal-test-secret-32-characters' })).status).toBe(409);
    expect((await request('/internal/backup/unlock', 'POST', { token: lock.token }, { 'x-internal-secret': 'internal-test-secret-32-characters' })).status).toBe(200);
    await create('unlocked-case');
  });
  it('recovers from expired leases and drains failed mutations without leaving the queue locked', async () => {
    const lockFile = join(directory, 'expired-lock.json');
    await writeFile(lockFile, JSON.stringify({ token: '00000000-0000-4000-8000-000000000000', expiresAt: new Date(Date.now() - 1000).toISOString() }));
    const gate = new MutationGate({ ...readConfig({}), backupLockFile: lockFile });
    expect((await gate.status()).locked).toBe(false);
    await expect(gate.mutate(async () => { throw new Error('Expected mutation failure'); })).rejects.toThrow('Expected mutation failure');
    const lock = await gate.acquire(30); expect(lock.activeMutations).toBe(0);
    await expect(gate.mutate(async () => 'forbidden')).rejects.toThrow('locked for backup');
    expect((await gate.release(lock.token)).locked).toBe(false);
    expect(await gate.mutate(async () => 'resumed')).toBe('resumed');
  });
  it('fails closed when a persisted backup lease is malformed', async () => {
    const lockFile = join(directory, 'invalid-lock.json'); await writeFile(lockFile, JSON.stringify({ token: 'invalid', expiresAt: 'invalid' }));
    const gate = new MutationGate({ ...readConfig({}), backupLockFile: lockFile });
    await expect(gate.mutate(async () => 'unsafe')).rejects.toThrow('Cannot read backup lock');
  });
});
// Keep the exhausted IP bucket last: rate limits intentionally survive requests.
it('throttles repeated login failures', async () => {
  for (let index = 0; index < 5; index++) expect((await request('/admin/login', 'POST', { email: 'owner@example.test', password: 'wrong' })).status).toBe(401);
  expect((await request('/admin/login', 'POST', { email: 'owner@example.test', password: 'wrong' })).status).toBe(429);
});

