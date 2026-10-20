import { developmentEnvironment, pnpmCli, startPnpm } from './local-runtime.mjs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const mode = args.find(arg => arg !== '--check') || 'all';
if (!['all', 'web', 'api'].includes(mode) || args.length > (check ? 2 : 1)) throw new Error('Usage: node scripts/dev.mjs [web|api] [--check]');
const { env } = developmentEnvironment();
const pnpm = pnpmCli(env);
if (check) {
  console.log(JSON.stringify({ node: process.version, mode, mediaDir: env.MEDIA_DIR, apiInternalUrl: env.API_INTERNAL_URL, staticPreview: env.ALLOW_STATIC_CONTENT === 'true', pnpmCli: pnpm }, null, 2));
} else {
  const command = mode === 'all' ? ['--parallel', '--filter', '@portfolio/web', '--filter', '@portfolio/api', 'dev'] : ['--filter', `@portfolio/${mode}`, 'dev'];
  startPnpm(pnpm, command, env);
}
