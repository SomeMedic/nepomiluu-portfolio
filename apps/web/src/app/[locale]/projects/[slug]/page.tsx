import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { imageUrl, type Locale } from '@portfolio/contracts';
import { getProject, getSiteUrl, isStaticContentPreview } from '@/lib/content';
import { CaseView } from '@/components/case/CaseView';
import { SiteHeader } from '@/components/site-header';
import { ContactFooter } from '@/components/contact-footer';

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
  const site = getSiteUrl();
  const path = `/${locale}/projects/${project.slug}`;
  const canonical = new URL(path, site).href;
  const { content } = project;
  const images = content.cover ? [{ url: new URL(imageUrl(content.cover, 'full'), site).href, alt: content.cover.alt[locale] }] : [];
  return {
    title: content.seoTitle[locale],
    description: content.seoDescription[locale],
    alternates: { canonical, languages: { 'ru-RU': new URL(`/ru/projects/${project.slug}`, site).href, 'en-US': new URL(`/en/projects/${project.slug}`, site).href, 'x-default': new URL(`/ru/projects/${project.slug}`, site).href } },
    robots: isStaticContentPreview() ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: 'article', title: content.seoTitle[locale], description: content.seoDescription[locale], url: canonical, siteName: locale === 'ru' ? 'Ульяна Непомилуева' : 'Uliana Nepomilueva', locale: locale === 'ru' ? 'ru_RU' : 'en_US', alternateLocale: [locale === 'ru' ? 'en_US' : 'ru_RU'], publishedTime: project.publishedAt, images },
    twitter: { card: content.cover ? 'summary_large_image' : 'summary', title: content.seoTitle[locale], description: content.seoDescription[locale], images: images.map(image => image.url) },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { locale: value, slug } = await params;
  const locale = checkedLocale(value);
  const project = await getProject(slug);
  if (!project) notFound();
  return <><SiteHeader locale={locale} slug={project.slug} /><CaseView project={project} locale={locale} /><ContactFooter locale={locale} /></>;
}
