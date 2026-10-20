import type { Metadata } from 'next';
import type { Locale } from '@portfolio/contracts';
import { notFound } from 'next/navigation';
import { getHome, getSiteUrl, isStaticContentPreview } from '@/lib/content';
import { homeMetadata, homeStructuredData } from '@/lib/seo';
import { StructuredData } from '@/components/structured-data';
import { SiteHeader } from '@/components/site-header';
import { ContactFooter } from '@/components/contact-footer';
import { Home } from '@/components/home/Home';
type Props = { params: Promise<{ locale: string }> };

function checkedLocale(value: string): Locale {
  if (value !== 'ru' && value !== 'en') notFound();
  return value;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: value } = await params;
  return homeMetadata(getSiteUrl(), checkedLocale(value), isStaticContentPreview());
}

export default async function HomePage({ params }: Props) {
  const { locale: value } = await params;
  const locale = checkedLocale(value);
  const projects = await getHome();
  return <>
    <StructuredData data={homeStructuredData(getSiteUrl(), locale)} />
    <a className="skip" href="#main-content">{locale === 'ru' ? 'К содержимому' : 'Skip to content'}</a>
    <div id="top" />
    <SiteHeader locale={locale} />
    <main id="main-content" className="siteMain"><Home locale={locale} projects={projects} /></main>
    <ContactFooter locale={locale} />
  </>;
}
