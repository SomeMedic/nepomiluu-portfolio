import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export default async function teardown() {
  const runDir = process.env.PORTFOLIO_E2E_RUN_DIR;
  if (!runDir) return;
  const file = path.join(runDir, 'state.json');
  if (!existsSync(file)) return;
  const state = JSON.parse(readFileSync(file, 'utf8')) as { webUrl: string; shutdownSecret: string };
  if (state.webUrl !== 'http://127.0.0.1:3100' || !state.shutdownSecret) throw new Error('Invalid isolated harness teardown state');
  const response = await fetch(`${state.webUrl}/__portfolio_e2e/shutdown`, { method: 'POST', headers: { 'x-e2e-secret': state.shutdownSecret }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Isolated harness shutdown failed (${response.status})`);
  // Wait for actual resource cleanup before Playwright terminates the Windows process.
  const completed = path.join(runDir, 'shutdown-complete');
  const deadline = Date.now() + 30_000;
  while (!existsSync(completed) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  if (!existsSync(completed)) throw new Error('Isolated harness did not finish cleanup within 30 seconds');
}
