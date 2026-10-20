import { ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CONFIG, type ApiConfig } from './config.js';
interface Lock { token: string; expiresAt: string }
/** One API process serializes admissions; the persistent lease survives a restart. */
@Injectable()
export class MutationGate {
  private active = 0;
  private serial: Promise<unknown> = Promise.resolve();
  private locking: Promise<unknown> = Promise.resolve();
  private lock: Lock | null = null;
  private initialized = false;
  private draining = false;
  constructor(@Inject(CONFIG) private readonly config: ApiConfig) {}
  private async initialize() {
    if (this.initialized) return;
    try {
      const value = JSON.parse(await readFile(this.config.backupLockFile, 'utf8'));
      if (!value || typeof value.token !== 'string' || !/^[a-f0-9-]{36}$/.test(value.token) || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) throw new Error('Invalid backup lock');
      if (Date.parse(value.expiresAt) > Date.now()) this.lock = value;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot read backup lock; refusing content mutation', { cause: error }); }
    this.initialized = true;
  }
  private async current() {
    await this.initialize();
    if (this.lock && Date.parse(this.lock.expiresAt) <= Date.now()) { await rm(this.config.backupLockFile, { force: true }); this.lock = null; }
    return this.lock;
  }
  async status() { const lock = await this.current(); return { locked: !!lock || this.draining, activeMutations: this.active, expiresAt: lock?.expiresAt || null }; }
  async mutate<T>(fn: () => Promise<T>): Promise<T> {
    if (await this.current() || this.draining) throw new ServiceUnavailableException('Content is locked for backup; retry shortly');
    this.active++;
    const run = this.serial.then(fn);
    this.serial = run.catch(() => undefined);
    try { return await run; } finally { this.active--; }
  }
  async acquire(ttlSeconds = 300) {
    const execute = async () => {
      if (await this.current() || this.draining) throw new ConflictException('Backup lock already held');
      this.draining = true;
      try {
        await this.serial;
        const lock = { token: randomUUID(), expiresAt: new Date(Date.now() + Math.max(30, Math.min(900, ttlSeconds)) * 1000).toISOString() };
        await mkdir(dirname(this.config.backupLockFile), { recursive: true });
        const temp = `${this.config.backupLockFile}.${randomUUID()}.tmp`;
        await writeFile(temp, JSON.stringify(lock), { mode: 0o600 });
        await rename(temp, this.config.backupLockFile);
        this.lock = lock;
        return { ...(await this.status()), token: lock.token };
      } finally { this.draining = false; }
    };
    const result = this.locking.then(execute);
    this.locking = result.catch(() => undefined);
    return result;
  }
  async release(token: string) {
    const lock = await this.current();
    if (lock && lock.token !== token) throw new ConflictException('Backup lock token does not match');
    if (lock) { await rm(this.config.backupLockFile, { force: true }); this.lock = null; }
    return this.status();
  }
}
