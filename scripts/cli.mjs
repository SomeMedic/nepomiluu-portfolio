import { developmentEnvironment, pnpmCli, startPnpm } from './local-runtime.mjs';

try {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const operation = args.find(arg => arg !== '--check');
  if (!['seed', 'admin:create', 'admin:reset'].includes(operation) || args.length !== (check ? 2 : 1)) throw new Error('Usage: node scripts/cli.mjs seed|admin:create|admin:reset [--check]');
  const { env, envFile } = developmentEnvironment({ required: true });
  const pnpm = pnpmCli(env);
  const apiCommand = operation === 'seed' ? 'seed' : 'owner';
  if (check) {
    console.log(JSON.stringify({ node: process.version, operation, apiCommand, envFile, mediaDir: env.MEDIA_DIR, pnpmCli: pnpm }, null, 2));
  } else {
    // Explicit Node prevents pnpm/tsx Windows shims selecting a global Node 22.
    // Inherited stdio sends the password straight to the API CLI without logging it.
    startPnpm(pnpm, ['--filter', '@portfolio/api', 'exec', process.execPath, '--import', 'tsx', 'src/cli.ts', apiCommand], env);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
