import type { MetadataRoute } from 'next';
import { getRoutes,getSiteUrl } from '@/lib/content';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const site=getSiteUrl().origin;const projects=await getRoutes();return ['ru','en'].flatMap(locale=>[{url:`${site}/${locale}`,alternates:{languages:{ru:`${site}/ru`,en:`${site}/en`}}},...projects.map(p=>({url:`${site}/${locale}/projects/${p.slug}`,lastModified:p.publishedAt,alternates:{languages:{ru:`${site}/ru/projects/${p.slug}`,en:`${site}/en/projects/${p.slug}`}}}))])}
