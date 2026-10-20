import { createRequire } from 'node:module';
import { access } from 'node:fs/promises';
const require = createRequire('/app/apps/api/package.json');
const mongoose = require('mongoose');
const uri = new URL(process.env.MONGODB_URI);
const target = process.argv[2];
if (target && target !== '--runtime') {
  if (!/^portfolio_restore_[a-z0-9_]{1,40}$/.test(target)) throw new Error('Refusing non-isolated database');
  uri.pathname = `/${target}`;
}
const connection = mongoose.createConnection(uri.toString(), { serverSelectionTimeoutMS: 10000 });
try {
  await connection.asPromise();
  const db = connection.db;
  const server = await db.admin().serverInfo();
  const feature = await db.admin().command({ getParameter: 1, featureCompatibilityVersion: 1 });
  const fcv = feature.featureCompatibilityVersion;
  if (fcv.targetVersion || fcv.previousVersion) throw new Error('MongoDB FCV is transitioning; retry after the upgrade completes');
  const runtime = { mongoVersion: server.version, mongoFcv: fcv.version, nodeVersion: process.version };
  if (target === '--runtime') { process.stdout.write(JSON.stringify(runtime)); }
  else {
    const projects = await db.collection('projects').find({}, { projection: { _id: 1, slug: 1, draft: 1, publishedSnapshot: 1 } }).sort({ _id: 1 }).toArray();
    const media = await db.collection('media').find({}, { projection: { _id: 1 } }).sort({ _id: 1 }).toArray();
    const homes = await db.collection('homes').find({}).sort({ _id: 1 }).toArray();
    const ownerCount = await db.collection('owners').countDocuments();
    const builtinFiles = [];
    for (const name of ['fomina-home', 'fomina-doctors', 'fomina-service']) {
      try { await access(`${process.env.PUBLIC_ASSETS_DIR}/${name}.webp`); builtinFiles.push(`builtin:${name}`); } catch { /* Verifier reports a referenced missing asset. */ }
    }
    process.stdout.write(JSON.stringify({ database: db.databaseName, ...runtime, projects, media, homes, ownerCount, builtinFiles }));
  }
} finally { await connection.close(); }
