import type { MetadataRoute } from 'next';
import { locales } from '@portfolio/contracts';
import { getRoutes, getSiteUrl } from '@/lib/content';
import { localizedUrls } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const projects = await getRoutes();
  return locales.flatMap(locale => [
    { url: localizedUrls(site)[locale], alternates: { languages: localizedUrls(site) } },
    ...projects.map(project => {
      const languages = localizedUrls(site, `/projects/${project.slug}`);
      return { url: languages[locale], lastModified: project.publishedAt, alternates: { languages } };
    }),
  ]);
}
