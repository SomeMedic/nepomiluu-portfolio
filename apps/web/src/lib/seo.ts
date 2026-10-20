import type { Metadata } from 'next';
import { imageUrl, type Locale, type PublishedProject } from '@portfolio/contracts';

export const profile = {
  ru: {
    name: 'Ульяна Непомилуева',
    title: 'Ульяна Непомилуева — UX/UI и продуктовый дизайнер',
    description: 'Портфолио Ульяны Непомилуевой: UX/UI и продуктовый дизайн, SaaS, e-commerce и MedTech. От сложных сценариев — к понятным интерфейсам и дизайн-системам.',
    imageAlt: 'Ульяна Непомилуева — UX/UI и продуктовый дизайнер. Редакционная обложка в молочно-терракотовой палитре.',
    ogLocale: 'ru_RU',
  },
  en: {
    name: 'Uliana Nepomilueva',
    title: 'Uliana Nepomilueva — UX/UI & Product Designer',
    description: 'UX/UI and product design portfolio by Uliana Nepomilueva. SaaS, e-commerce and MedTech: from complex user journeys to clear interfaces and design systems.',
    imageAlt: 'Uliana Nepomilueva — UX/UI & Product Designer. An ivory and terracotta editorial portfolio cover.',
    ogLocale: 'en_US',
  },
} as const;

export function localizedUrls(site: URL, suffix = '') {
  return {
    ru: new URL(`/ru${suffix}`, site).href,
    en: new URL(`/en${suffix}`, site).href,
    'x-default': new URL(`/ru${suffix}`, site).href,
  };
}

export function homeSocialImage(site: URL, locale: Locale) {
  return {
    url: new URL(`/social/portfolio-${locale}-v1.jpg`, site).href,
    width: 1200,
    height: 630,
    type: 'image/jpeg',
    alt: profile[locale].imageAlt,
  };
}

// These derivatives follow the selected cover, not the project's slug. A cover
// changed in the CMS must never keep an unrelated built-in social image.
const socialCovers = new Map([
  ['builtin:clypse-cover', '/social/clypse-cover-v1.jpg'],
  ['builtin:fomina-cover', '/social/fomina-cover-v1.jpg'],
]);

export function projectSocialImage(site: URL, locale: Locale, project: PublishedProject) {
  const cover = project.content.cover;
  if (!cover) return homeSocialImage(site, locale);
  const prepared = socialCovers.get(cover.mediaId);
  return prepared
    ? { url: new URL(prepared, site).href, width: 1200, height: 630, type: 'image/jpeg', alt: cover.alt[locale] }
    : { url: new URL(imageUrl(cover, 'full'), site).href, type: 'image/webp', alt: cover.alt[locale] };
}

function pageMetadata(site: URL, locale: Locale, title: string, description: string, suffix: string, image: ReturnType<typeof projectSocialImage>, preview: boolean): Metadata {
  const languages = localizedUrls(site, suffix);
  return {
    metadataBase: site,
    title,
    description,
    authors: [{ name: profile[locale].name, url: new URL(`/${locale}`, site).href }],
    creator: profile[locale].name,
    alternates: { canonical: languages[locale], languages },
    robots: preview ? { index: false, follow: false } : {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url: languages[locale],
      siteName: profile[locale].name,
      locale: profile[locale].ogLocale,
      alternateLocale: [profile[locale === 'ru' ? 'en' : 'ru'].ogLocale],
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}

export function homeMetadata(site: URL, locale: Locale, preview = false): Metadata {
  return pageMetadata(site, locale, profile[locale].title, profile[locale].description, '', homeSocialImage(site, locale), preview);
}

export function projectMetadata(site: URL, locale: Locale, project: PublishedProject, preview = false): Metadata {
  const metadata = pageMetadata(site, locale, project.content.seoTitle[locale], project.content.seoDescription[locale], `/projects/${project.slug}`, projectSocialImage(site, locale, project), preview);
  metadata.openGraph = {
    ...metadata.openGraph,
    type: 'article',
    // The public API exposes the latest publication, not the initial date.
    modifiedTime: project.publishedAt,
    authors: [new URL(`/${locale}`, site).href],
  };
  return metadata;
}

function person(site: URL, locale: Locale) {
  return {
    '@type': 'Person',
    '@id': new URL('/#person', site).href,
    name: profile[locale].name,
    alternateName: profile[locale === 'ru' ? 'en' : 'ru'].name,
    url: new URL(`/${locale}`, site).href,
    jobTitle: 'UX/UI & Product Designer',
    image: new URL('/assets/portrait-source-lossless.webp', site).href,
    sameAs: ['https://t.me/nepomiluu', 'https://vk.com/unepomilueva'],
  };
}

export function homeStructuredData(site: URL, locale: Locale) {
  const url = new URL(`/${locale}`, site).href;
  const owner = person(site, locale);
  const image = homeSocialImage(site, locale);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      owner,
      { '@type': 'WebSite', '@id': new URL('/#website', site).href, url: site.href, name: profile[locale].name, inLanguage: ['ru', 'en'], creator: { '@id': owner['@id'] } },
      { '@type': 'ProfilePage', '@id': `${url}#webpage`, url, name: profile[locale].title, description: profile[locale].description, inLanguage: locale, isPartOf: { '@id': new URL('/#website', site).href }, mainEntity: { '@id': owner['@id'] }, primaryImageOfPage: { '@type': 'ImageObject', url: image.url, width: image.width, height: image.height, caption: image.alt } },
    ],
  };
}

export function projectStructuredData(site: URL, locale: Locale, project: PublishedProject) {
  const url = localizedUrls(site, `/projects/${project.slug}`)[locale];
  const owner = person(site, locale);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      owner,
      { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: project.content.seoTitle[locale], description: project.content.seoDescription[locale], inLanguage: locale, mainEntity: { '@id': `${url}#work` }, author: { '@id': owner['@id'] } },
      { '@type': 'CreativeWork', '@id': `${url}#work`, url, name: project.content.title[locale], description: project.content.summary[locale], inLanguage: locale, creator: { '@id': owner['@id'] }, dateModified: project.publishedAt, image: projectSocialImage(site, locale, project).url, mainEntityOfPage: { '@id': `${url}#webpage` } },
    ],
  };
}

// CMS text is untrusted even inside JSON: a literal </script> closes the HTML
// element before JSON parsing. Escaping < preserves text without that boundary.
export function serializeStructuredData(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
