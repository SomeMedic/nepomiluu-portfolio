import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { developmentEnvironment, root } from './local-runtime.mjs';

test('local CLI refuses missing or incomplete .env despite an inherited Mongo URI', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'portfolio-cli-'));
  try {
    const inherited = { MONGODB_URI: 'mongodb://other-project.invalid/do-not-connect' };
    assert.throws(() => developmentEnvironment({ projectRoot, required: true, inherited }), /requires the repository .env/);
    await writeFile(join(projectRoot, '.env'), 'PUBLIC_ORIGIN=http://localhost:3000\n');
    assert.throws(() => developmentEnvironment({ projectRoot, required: true, inherited }), /explicit MONGODB_URI/);
    await writeFile(join(projectRoot, '.env'), 'MONGODB_URI=invalid\n');
    assert.throws(() => developmentEnvironment({ projectRoot, required: true, inherited }), /explicit MONGODB_URI/);
  } finally { await rm(projectRoot, { recursive: true, force: true }); }
});

test('repository .env overrides inherited settings and resolves local media consistently', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'portfolio-cli-'));
  try {
    await writeFile(join(projectRoot, '.env'), 'MONGODB_URI=mongodb://127.0.0.1:27017/this_project\nMEDIA_DIR=.data/media\nINTERNAL_SECRET=local-shared-secret\n');
    const inherited = { mongodb_uri: 'mongodb://other-project.invalid/do-not-connect', MONGODB_URI: 'mongodb://another.invalid/do-not-connect', Path: dirname(process.execPath) };
    const { env } = developmentEnvironment({ projectRoot, required: true, inherited });
    assert.equal(env.MONGODB_URI, 'mongodb://127.0.0.1:27017/this_project');
    assert.equal(env.mongodb_uri, undefined);
    assert.equal(env.MEDIA_DIR, join(projectRoot, '.data', 'media'));
    assert.equal(env.INTERNAL_SECRET, 'local-shared-secret');
    assert.equal(env.NODE_ENV, 'development');
    assert.ok(env.PATH.startsWith(dirname(process.execPath)));
    assert.throws(() => developmentEnvironment({ projectRoot, required: true, inherited: { NODE_ENV: 'production' } }), /development environment/);
  } finally { await rm(projectRoot, { recursive: true, force: true }); }
});

test('CLI routes commands through the current Node and passes stdin without exposing secrets', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'portfolio-cli-'));
  try {
    await mkdir(join(projectRoot, 'scripts'));
    for (const name of ['cli.mjs', 'local-runtime.mjs']) await copyFile(join(root, 'scripts', name), join(projectRoot, 'scripts', name));
    const fakePnpm = join(projectRoot, 'pnpm.cjs');
    await writeFile(fakePnpm, `let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>console.log(JSON.stringify({args:process.argv.slice(2),node:process.version,mongo:process.env.MONGODB_URI,stdinForwarded:input==='test-secret-on-stdin\\n'})));`);
    await writeFile(join(projectRoot, '.env'), `MONGODB_URI=mongodb://127.0.0.1:27017/this_project\nPNPM_CLI_PATH="${fakePnpm.replaceAll('\\', '/')}"\n`);
    for (const operation of ['seed', 'admin:create', 'admin:reset']) {
      const result = spawnSync(process.execPath, [join(projectRoot, 'scripts', 'cli.mjs'), operation], { input: 'test-secret-on-stdin\n', encoding: 'utf8', timeout: 10000, windowsHide: true, env: { ...process.env, MONGODB_URI: 'mongodb://other-project.invalid/do-not-connect', NODE_ENV: 'development' } });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(!result.stdout.includes('test-secret-on-stdin'));
      const output = JSON.parse(result.stdout);
      assert.deepEqual(output.args, ['--filter', '@portfolio/api', 'exec', process.execPath, '--import', 'tsx', 'src/cli.ts', operation === 'seed' ? 'seed' : 'owner']);
      assert.equal(output.mongo, 'mongodb://127.0.0.1:27017/this_project');
      assert.equal(output.node, process.version);
      assert.equal(output.stdinForwarded, true);
    }
    const checked = spawnSync(process.execPath, [join(projectRoot, 'scripts', 'cli.mjs'), 'admin:reset', '--check'], { encoding: 'utf8', timeout: 10000, windowsHide: true, env: { ...process.env, NODE_ENV: 'development' } });
    assert.equal(checked.status, 0, checked.stderr);
    assert.equal(JSON.parse(checked.stdout).apiCommand, 'owner');
    assert.ok(!checked.stdout.includes('mongodb://'));
  } finally { await rm(projectRoot, { recursive: true, force: true }); }
});
