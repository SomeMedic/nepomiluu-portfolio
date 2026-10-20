import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkArchiveNames, fileManifest, verifyManifest, verifyReferences } from './operations.mjs';
import { inventoryBuiltinFiles } from './container/builtin-assets.mjs';

test('backup inventories current project boards from drafts and publications, not a legacy allowlist', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-builtins-'));
  const pair = { ru: 'Экран', en: 'Screen' };
  const image = name => ({ mediaId: `builtin:${name}`, alt: pair });
  const projects = [{ slug: 'case', draft: { cover: image('clypse-cover') }, publishedSnapshot: { blocks: [{ images: [image('fomina-cover'), image('clypse-cover')] }] } }];
  try {
    for (const name of ['clypse-cover', 'fomina-cover', 'unreferenced']) await writeFile(join(directory, `${name}.webp`), 'fixture');
    assert.deepEqual(await inventoryBuiltinFiles(projects, directory), ['builtin:clypse-cover', 'builtin:fomina-cover']);
    await rm(join(directory, 'fomina-cover.webp'));
    const builtinFiles = await inventoryBuiltinFiles(projects, directory);
    assert.deepEqual(builtinFiles, ['builtin:clypse-cover']);
    const mediaDir = join(directory, 'media');
    await mkdir(mediaDir);
    await assert.rejects(verifyReferences({ projects: [{ draft: projects[0].publishedSnapshot }], media: [], homes: [], builtinFiles }, mediaDir), /Missing builtin media: builtin:fomina-cover/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('builtin inventory rejects paths outside the public asset directory', async () => {
  for (const mediaId of ['builtin:../secret', 'builtin:/secret', 'builtin:a\\b']) {
    await assert.rejects(inventoryBuiltinFiles([{ draft: { mediaId } }], tmpdir()), /Unsafe builtin media ID/);
  }
});

test('restore rejects traversal, links and duplicate archive entries', () => {
  const base = 'manifest.json\ninventory.json\ndatabase.archive.gz\nmedia/\n';
  assert.doesNotThrow(() => checkArchiveNames(base, '-rw------- manifest.json\ndrwx------ media/'));
  assert.doesNotThrow(() => checkArchiveNames(base.replaceAll('\n', '\r\n'), '-rw------- manifest.json\r\ndrwx------ media/\r\n'));
  for (const name of ['../escaped', '/absolute', 'media/../../escaped', 'media\\escaped', 'manifest.json']) assert.throws(() => checkArchiveNames(base + name));
  assert.throws(() => checkArchiveNames(base, 'lrwxrwxrwx media/link -> /etc'));
  assert.throws(() => checkArchiveNames('media/'));
});

test('manifest detects corruption, removed files and additional files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-ops-'));
  try {
    await writeFile(join(directory, 'database.archive.gz'), 'database bytes');
    await writeFile(join(directory, 'inventory.json'), '{}');
    const manifest = { format: 1, sourceDatabase: 'portfolio', files: await fileManifest(directory) };
    await verifyManifest(directory, manifest);
    await writeFile(join(directory, 'database.archive.gz'), 'corruption');
    await assert.rejects(verifyManifest(directory, manifest), /mismatch/);
    await writeFile(join(directory, 'database.archive.gz'), 'database bytes');
    await writeFile(join(directory, 'extra.txt'), 'unexpected');
    await assert.rejects(verifyManifest(directory, manifest), /file list/);
    await rm(join(directory, 'extra.txt'));
    await rm(join(directory, 'inventory.json'));
    await assert.rejects(verifyManifest(directory, manifest), /file list/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('restore verifies RU/EN references, all media variants and home publication', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-ops-'));
  const mediaId = '12345678-1234-1234-1234-123456789abc';
  const pair = { ru: 'Русский', en: 'English' };
  const content = Object.fromEntries(['title', 'summary', 'category', 'role', 'period', 'status', 'seoTitle', 'seoDescription'].map(key => [key, pair]));
  content.cover = { mediaId, alt: pair };
  const inventory = { projects: [{ _id: 'project', slug: 'project', draft: content, publishedSnapshot: content }], media: [{ _id: mediaId }], homes: [{ first: 'project', second: null }], builtinFiles: [] };
  try {
    await mkdir(join(directory, mediaId));
    for (const variant of ['thumb', 'page', 'full']) await writeFile(join(directory, mediaId, `${variant}.webp`), 'fixture');
    const result = await verifyReferences(inventory, directory);
    assert.deepEqual(result.locales, ['ru', 'en']);
    assert.equal(result.referencedMedia, 1);
    const incomplete = structuredClone(inventory);
    delete incomplete.projects[0].draft.cover.alt.en;
    await assert.rejects(verifyReferences(incomplete, directory), /RU\/EN/);
    const draftHome = structuredClone(inventory);
    draftHome.projects[0].publishedSnapshot = null;
    await assert.rejects(verifyReferences(draftHome, directory), /unpublished/);
    await rm(join(directory, mediaId, 'page.webp'));
    await assert.rejects(verifyReferences(inventory, directory), /ENOENT/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
