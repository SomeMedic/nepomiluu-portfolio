import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/next-env.d.ts'] },
  js.configs.recommended, ...ts.configs.recommended,
  { files: ['**/*.{ts,tsx,js,mjs}'], languageOptions: { globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', fetch: 'readonly', window: 'readonly', document: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly', FormData: 'readonly', File: 'readonly', Request: 'readonly', Response: 'readonly', HTMLElement: 'readonly', HTMLImageElement: 'readonly', HTMLDialogElement: 'readonly', Event: 'readonly', MouseEvent: 'readonly', ResizeObserver: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', navigator: 'readonly', localStorage: 'readonly', history: 'readonly', sessionStorage: 'readonly' } }, rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } }
);
