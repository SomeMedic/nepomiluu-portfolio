import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Locale } from '@portfolio/contracts';
import { getProject, getSiteUrl, isStaticContentPreview } from '@/lib/content';
import { CaseView } from '@/components/case/CaseView';
import { SiteHeader } from '@/components/site-header';
import { ContactFooter } from '@/components/contact-footer';
import { projectMetadata, projectStructuredData } from '@/lib/seo';
import { StructuredData } from '@/components/structured-data';

type Props = { params: Promise<{ locale: string; slug: string }> };

function checkedLocale(value: string): Locale {
  if (value !== 'ru' && value !== 'en') notFound();
  return value;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: value, slug } = await params;
  const locale = checkedLocale(value);
  const project = await getProject(slug);
  if (!project) notFound();
  return projectMetadata(getSiteUrl(), locale, project, isStaticContentPreview());
}

export default async function ProjectPage({ params }: Props) {
  const { locale: value, slug } = await params;
  const locale = checkedLocale(value);
  const project = await getProject(slug);
  if (!project) notFound();
  return <><StructuredData data={projectStructuredData(getSiteUrl(), locale, project)} /><SiteHeader locale={locale} slug={project.slug} /><CaseView project={project} locale={locale} /><ContactFooter locale={locale} /></>;
}
