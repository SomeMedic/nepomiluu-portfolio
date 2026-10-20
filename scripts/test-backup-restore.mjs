// This is an integration check against a fresh, explicitly named test project.
// It creates synthetic data only after confirming the application DB is empty.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { composeFor, id, options, reportError, root, run } from './operations.mjs';

async function main() {
  const opts = options(process.argv.slice(2));
  const compose = await composeFor(opts['env-file']);
  if (!/^(nepomiluu|portfolio)-(infra-check|restore-test)[a-z0-9-]*$/.test(compose.config.name)) throw new Error('Use a dedicated nepomiluu-infra-check* or portfolio-restore-test* Compose project');
  const output = resolve(opts['output-dir'] || join(root, '.data', `backup-integration-${id()}`));
  await mkdir(output, { recursive: true });
  await compose.exec(['up', '-d', '--no-build', '--wait', 'mongo', 'api'], { timeout: 240000 });
  const fixture = `
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
const require=createRequire('/app/apps/api/package.json');
const mongoose=require('mongoose'); const sharp=require('sharp');
const connection=await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
try {
const db=connection.db;
for(const name of ['projects','media','owners','homes']) if(await db.collection(name).countDocuments()) throw new Error('Test DB must be empty');
const ids=[randomUUID(),randomUUID()];
for(const mediaId of ids){
const bytes=await sharp({create:{width:24,height:18,channels:3,background:'#a98d69'}}).webp().toBuffer();
await mkdir(join(process.env.MEDIA_DIR,mediaId),{recursive:true});
for(const variant of ['thumb','page','full']) await writeFile(join(process.env.MEDIA_DIR,mediaId,variant+'.webp'),bytes);
await db.collection('media').insertOne({_id:mediaId,width:24,height:18,mime:'image/webp',bytes:bytes.length,hash:createHash('sha256').update(bytes).digest('hex'),originalName:'restore-fixture.webp',createdAt:new Date()});
}
const pair={ru:'Проверка восстановления',en:'Restore verification'};
const image=id=>({mediaId:id,alt:pair});
const content=id=>({title:pair,summary:pair,category:pair,role:pair,period:pair,status:pair,seoTitle:pair,seoDescription:pair,cover:image(id),blocks:[{id:'image',type:'image',image:image(id),caption:pair}],home:{headline:pair,subline:pair,stages:Array.from({length:3},()=>({label:pair,title:pair,body:pair,image:image(id),annotations:[]}))}});
const projects=[0,1,2].map(n=>{const draft=content(ids[n===2?1:0]);return {_id:randomUUID(),slug:'restore-fixture-'+n,revision:1,draft,publishedSnapshot:n===2?null:draft,firstPublishedAt:n===2?null:new Date(),publishedAt:n===2?null:new Date(),updatedAt:new Date()}});
await db.collection('projects').insertMany(projects);
await db.collection('homes').insertOne({_id:'home',first:projects[0]._id,second:projects[1]._id});
await db.collection('sessions').insertOne({_id:randomUUID(),email:'fixture@example.com',csrfToken:'fixture',expiresAt:new Date(Date.now()+3600000)});
process.stdout.write(JSON.stringify({mediaId:ids[0],projects:3,published:2,storedMedia:2}));
} finally {await connection.close();}
`;
  const created = JSON.parse(await compose.exec(['exec', '-T', 'api', 'node', '--input-type=module'], { input: fixture }));
  const backupArgs = [join(root, 'scripts/backup.mjs'), '--env-file', opts['env-file'], '--output-dir', output];
  const mediaOperation = async action => compose.exec(['exec', '-T', 'api', 'node', '--input-type=module', '-e', `import {copyFile,unlink} from 'node:fs/promises';import {join} from 'node:path';const page=join(process.env.MEDIA_DIR,process.argv[1],'page.webp');const source=${action === 'hide' ? 'page' : "'/tmp/restore-test-page.webp'"};const target=${action === 'hide' ? "'/tmp/restore-test-page.webp'" : 'page'};await copyFile(source,target,1);await unlink(source);`, created.mediaId]);
  await mediaOperation('hide');
  try { await assert.rejects(run(process.execPath, backupArgs, { timeout: 180000 })); }
  finally { await mediaOperation('restore'); }
  const lock = JSON.parse(await compose.exec(['exec', '-T', 'api', 'node', '/opt/portfolio-ops/lock.mjs', 'status']));
  assert.equal(lock.locked, false, 'Failed backup must release the content lock');
  const saved = JSON.parse(await run(process.execPath, backupArgs, { timeout: 240000 }));
  assert.equal(saved.verification.projects, 3);
  assert.equal(saved.verification.published, 2);
  assert.equal(saved.verification.storedMedia, 2);
  const restoreOutput = await run(process.execPath, [join(root, 'scripts/restore.mjs'), '--env-file', opts['env-file'], '--bundle', saved.bundle, '--restore-root', join(output, 'restores'), '--smoke'], { timeout: 240000 });
  const restored = JSON.parse(restoreOutput.slice(restoreOutput.indexOf('{')));
  assert.deepEqual(restored.verification, saved.verification);
  const sessionCheck = `import {createRequire} from 'node:module';const require=createRequire('/app/apps/api/package.json');const m=require('mongoose');const source=await m.createConnection(process.env.MONGODB_URI).asPromise();const u=new URL(process.env.MONGODB_URI);u.pathname='/'+process.argv[1];const target=await m.createConnection(u.toString()).asPromise();try{process.stdout.write(JSON.stringify({source:await source.db.collection('sessions').countDocuments(),restored:await target.db.collection('sessions').countDocuments()}));}finally{await source.close();await target.close();}`;
  const sessions = JSON.parse(await compose.exec(['exec', '-T', 'api', 'node', '--input-type=module', '-e', sessionCheck, restored.database]));
  assert.equal(sessions.source, 1);
  assert.equal(sessions.restored, 0, 'Ephemeral sessions must not be restored');
  const report = JSON.parse(await readFile(join(restored.mediaDir, '..', 'verification.json'), 'utf8'));
  assert.equal(report.smoke, true);
  console.log(JSON.stringify({ result: 'passed', failedBackupUnlock: true, sessionsExcluded: true, bundle: saved.bundle, restoreVerification: report }, null, 2));
}
main().catch(reportError);
