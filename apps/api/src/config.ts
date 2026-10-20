import { resolve } from 'node:path';
export interface ApiConfig { mongoUri: string; port: number; host: string; mediaDir: string; publicAssetsDir: string; internalSecret: string; webInternalUrl: string; publicOrigin: string; production: boolean; sessionHours: number; backupLockFile: string }
export function readConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const production = env.NODE_ENV === 'production';
  const mediaDir = resolve(env.MEDIA_DIR || './data/media');
  const internalSecret = env.INTERNAL_SECRET || '';
  if (production && internalSecret.length < 32) throw new Error('INTERNAL_SECRET must contain at least 32 characters in production');
  const publicOrigin = env.PUBLIC_ORIGIN || 'http://localhost:3000';
  if (production && !publicOrigin.startsWith('https://')) throw new Error('PUBLIC_ORIGIN must be HTTPS in production');
  return { mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/portfolio', port: Number(env.API_PORT || 4000), host: env.API_HOST || '127.0.0.1', mediaDir, publicAssetsDir: resolve(env.PUBLIC_ASSETS_DIR || '../../apps/web/public/assets'), internalSecret, webInternalUrl: env.WEB_INTERNAL_URL || 'http://127.0.0.1:3000', publicOrigin, production, sessionHours: 12, backupLockFile: resolve(env.BACKUP_LOCK_FILE || `${mediaDir}/.backup-lock.json`) };
}
export const CONFIG = Symbol('CONFIG');
