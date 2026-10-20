import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['packages/**/*.test.ts', 'apps/api/**/*.test.ts', 'apps/web/**/*.test.ts'], testTimeout: 30000 }, resolve: { alias: { '@portfolio/contracts': new URL('./packages/contracts/src/index.ts', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') } } });
