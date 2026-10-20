import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { composeFor, fileManifest, id, options, removeOwnedTemporary, reportError, run, verifyReferences } from './operations.mjs';
process.umask(0o077);

async function main() {
  const opts = options(process.argv.slice(2));
  const compose = await composeFor(opts['env-file']);
  const outputDir = resolve(opts['output-dir'] || '/var/backups/nepomiluu');
  if (outputDir === '/' || outputDir === resolve('.')) throw new Error('Choose a dedicated backup directory outside checkout/media');
  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  const backupId = id();
  const stage = join(outputDir, `.portfolio-backup-${backupId}`);
  const pending = join(outputDir, `.portfolio-bundle-${backupId}.tar.gz`);
  const final = join(outputDir, `portfolio-${backupId}.tar.gz`);
  await mkdir(stage, { mode: 0o700 });
  let lock;
  const runningImages = async () => JSON.parse(await compose.exec(['images', '--format', 'json'])).map(image => ({ container: image.ContainerName, imageId: image.ID })).sort((a, b) => a.container.localeCompare(b.container));
  const release = async () => {
    if (!lock) return;
    await compose.exec(['exec', '-T', 'api', 'node', '/opt/portfolio-ops/lock.mjs', 'unlock'], { input: JSON.stringify({ token: lock.token }), timeout: 30000 });
    lock = null;
  };
  let terminating = false;
  const onSignal = async () => { if (terminating) return; terminating = true; try { await release(); } finally { process.exit(130); } };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  try {
    lock = JSON.parse(await compose.exec(['exec', '-T', 'api', 'node', '/opt/portfolio-ops/lock.mjs', 'lock', '900']));
    if (!lock.locked || !lock.token || lock.activeMutations !== 0) throw new Error('API did not confirm a drained backup lock');
    const imageSnapshot = await runningImages();
    const leaseTime = () => { const left = Date.parse(lock.expiresAt) - Date.now() - 10000; if (left < 1000) throw new Error('Backup lock lease expired; refusing an inconsistent backup'); return left; };
    const dump = 'exec mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db "$MONGO_INITDB_DATABASE" --excludeCollection sessions --archive --gzip';
    await compose.exec(['exec', '-T', 'mongo', 'sh', '-c', dump], { outputFile: join(stage, 'database.archive.gz'), timeout: leaseTime() });
    await mkdir(join(stage, 'media'), { mode: 0o700 });
    await compose.exec(['cp', 'api:/data/media/.', join(stage, 'media')], { timeout: leaseTime() });
    for (const name of await readdir(join(stage, 'media'))) {
      if (name.startsWith('.upload-') || name.startsWith('.backup-lock')) await rm(join(stage, 'media', name), { recursive: true, force: true });
      else if (!/^[a-f0-9-]{36}$/.test(name)) throw new Error(`Unexpected media path: ${name}`);
    }
    const inventory = JSON.parse(await compose.exec(['exec', '-T', 'api', 'node', '/opt/portfolio-ops/inventory.mjs'], { timeout: leaseTime() }));
    const verification = await verifyReferences(inventory, join(stage, 'media'));
    const status = JSON.parse(await compose.exec(['exec', '-T', 'api', 'node', '/opt/portfolio-ops/lock.mjs', 'status'], { timeout: leaseTime() }));
    if (!status.locked || status.activeMutations !== 0 || status.expiresAt !== lock.expiresAt) throw new Error('API backup lock was lost during capture');
    if (JSON.stringify(await runningImages()) !== JSON.stringify(imageSnapshot)) throw new Error('Application images changed during capture; retry after deployment finishes');
    leaseTime();
    await writeFile(join(stage, 'inventory.json'), JSON.stringify(inventory, null, 2), { flag: 'wx', mode: 0o600 });
    // The consistent snapshot is now fully captured; compression needs no lock.
    await release();
    const manifest = { format: 1, backupId, createdAt: new Date().toISOString(), sourceDatabase: compose.db, mongoVersion: inventory.mongoVersion, mongoFcv: inventory.mongoFcv, nodeVersion: inventory.nodeVersion, images: Object.fromEntries(['api', 'web', 'mongo'].map(service => [service, compose.config.services[service].image])), runningImages: imageSnapshot, sessionPolicy: 'excluded; log in again after restore', verification, files: await fileManifest(stage) };
    await writeFile(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
    await run('tar', ['-C', stage, '-czf', pending, 'manifest.json', 'inventory.json', 'database.archive.gz', 'media'], { timeout: 600000 });
    await rename(pending, final);
    const archives = (await readdir(outputDir)).filter(name => /^portfolio-[0-9]{14}_[a-f0-9]{8}\.tar\.gz$/.test(name)).sort().reverse();
    for (const name of archives.slice(7)) await rm(join(outputDir, name));
    console.log(JSON.stringify({ bundle: final, verification, retained: Math.min(archives.length, 7) }, null, 2));
  } finally {
    try { await release(); } finally {
      process.removeListener('SIGTERM', onSignal);
      process.removeListener('SIGINT', onSignal);
      await removeOwnedTemporary(stage, outputDir);
      await rm(pending, { force: true });
    }
  }
}
main().catch(reportError);
