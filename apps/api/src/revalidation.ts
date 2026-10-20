import { Injectable, Inject, Logger } from '@nestjs/common';
import { CONFIG, type ApiConfig } from './config.js';
@Injectable()
export class Revalidation {
  private readonly logger = new Logger('Revalidation');
  constructor(@Inject(CONFIG) private readonly config: ApiConfig) {}
  async refresh(slugs: string[]) {
    if (!this.config.internalSecret) return;
    try {
      const response = await fetch(`${this.config.webInternalUrl}/api/revalidate`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-secret': this.config.internalSecret }, body: JSON.stringify({ slugs: [...new Set(slugs)] }), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) { this.logger.warn(`Cache refresh unavailable; public pages fall back to 60-second revalidation (${(error as Error).message})`); }
  }
}
