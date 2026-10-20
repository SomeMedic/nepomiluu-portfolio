import { createReadStream } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { checkArchiveNames, comparableInventory, composeFor, ensureNewDirectory, filesUnder, id, options, removeOwnedTemporary, reportError, run, verifyManifest, verifyReferences } from './operations.mjs';
process.umask(0o077);

async function main() {
  const opts = options(process.argv.slice(2));
  if (!opts.bundle) throw new Error('Required: --bundle /absolute/path/to/portfolio-....tar.gz');
  const bundle = resolve(opts.bundle);
  const compose = await composeFor(opts['env-file']);
  const restoreId = id();
  const database = opts.database || `portfolio_restore_${restoreId}`;
  if (!/^portfolio_restore_[a-z0-9_]{1,40}$/.test(database) || database === compose.db) throw new Error('Restore is allowed only into a new portfolio_restore_* database');
  const restoreRoot = resolve(opts['restore-root'] || '/var/backups/nepomiluu/restore-checks');
  await mkdir(restoreRoot, { recursive: true, mode: 0o700 });
  const stage = join(restoreRoot, `.portfolio-restore-${restoreId}`);
  const destination = join(restoreRoot, restoreId);
  await ensureNewDirectory(stage);
  try {
    const names = await run('tar', ['-tzf', bundle], { timeout: 120000 });
    const types = await run('tar', ['-tvzf', bundle], { timeout: 120000 });
    checkArchiveNames(names, types);
    await run('tar', ['-xzf', bundle, '-C', stage, '--no-same-owner', '--no-same-permissions'], { timeout: 600000 });
    const manifest = JSON.parse(await readFile(join(stage, 'manifest.json'), 'utf8'));
    await verifyManifest(stage, manifest);
    if (!/^[a-zA-Z0-9_-]{1,63}$/.test(manifest.sourceDatabase)) throw new Error('Unsafe source database in manifest');
    const inventory = JSON.parse(await readFile(join(stage, 'inventory.json'), 'utf8'));
    await verifyReferences(inventory, join(stage, 'media'));
    const runtime = JSON.parse(await compose.exec(['exec', '-T', 'api', 'node', '/opt/portfolio-ops/inventory.mjs', '--runtime']));
    if (runtime.mongoVersion.split('.')[0] !== manifest.mongoVersion.split('.')[0] || runtime.mongoFcv !== manifest.mongoFcv) throw new Error('Restore requires the same MongoDB major and FCV as the backup');
    const emptyCheck = `mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval 'const name=process.env.RESTORE_DATABASE; if(db.adminCommand({listDatabases:1,nameOnly:true}).databases.some(d=>d.name===name)) quit(17);'`;
    await compose.exec(['exec', '-T', '-e', `RESTORE_DATABASE=${database}`, 'mongo', 'sh', '-c', emptyCheck]);
    await ensureNewDirectory(destination);
    // Only this mounted subdirectory is readable by the isolated non-root API;
    // the containing restore directory remains private to its operator.
    await mkdir(join(destination, 'media'), { mode: 0o755 });
    await chmod(join(destination, 'media'), 0o755);
    for (const path of await filesUnder(join(stage, 'media'))) {
      const target = join(destination, 'media', path);
      await mkdir(resolve(target, '..'), { recursive: true, mode: 0o755 });
      await chmod(resolve(target, '..'), 0o755);
      await copyFile(join(stage, 'media', path), target, 1 /* COPYFILE_EXCL */);
      await chmod(target, 0o644);
    }
    const restore = 'exec mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --stopOnError --nsInclude "$SOURCE_DATABASE.*" --nsExclude "$SOURCE_DATABASE.sessions" --nsFrom "$SOURCE_DATABASE.*" --nsTo "$RESTORE_DATABASE.*"';
    await compose.exec(['exec', '-T', '-e', `SOURCE_DATABASE=${manifest.sourceDatabase}`, '-e', `RESTORE_DATABASE=${database}`, 'mongo', 'sh', '-c', restore], { input: createReadStream(join(stage, 'database.archive.gz')), timeout: 600000 });
    const restored = JSON.parse(await compose.exec(['exec', '-T', 'api', 'node', '/opt/portfolio-ops/inventory.mjs', database]));
    if (JSON.stringify(comparableInventory(inventory)) !== JSON.stringify(comparableInventory(restored))) throw new Error('Restored DB content differs from captured inventory');
    const verification = await verifyReferences(restored, join(destination, 'media'));
    if (opts.smoke) {
      const output = await compose.exec(['run', '--rm', '--no-deps', '-T', '--volume', `${join(destination, 'media')}:/restore-media:ro`, '--entrypoint', 'node', 'api', '/opt/portfolio-ops/smoke.mjs', database], { timeout: 60000 });
      process.stdout.write(output);
    }
    const result = { verifiedAt: new Date().toISOString(), bundle, database, mediaDir: join(destination, 'media'), verification, smoke: Boolean(opts.smoke), workingDatabaseUntouched: true };
    await writeFile(join(destination, 'verification.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(result, null, 2));
  } finally { await removeOwnedTemporary(stage, restoreRoot); }
}
main().catch(reportError);
