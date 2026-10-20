import type { MetadataRoute } from 'next';
import { getSiteUrl, isStaticContentPreview } from '@/lib/content';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (isStaticContentPreview()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    // Public case covers uploaded through the CMS are served here. The API still
    // enforces publication/authentication; robots.txt never grants file access.
    rules: { userAgent: '*', allow: ['/', '/api/media/'], disallow: ['/admin', '/api/'] },
    sitemap: new URL('/sitemap.xml', getSiteUrl()).href,
  };
}
