import { describe, expect, it } from 'vitest';
import type { PublishedProject } from '@portfolio/contracts';
import { seedProjects } from '../../../../packages/contracts/src/seed';
import { homeMetadata, homeStructuredData, localizedUrls, projectMetadata, projectSocialImage, projectStructuredData, serializeStructuredData } from './seo';

const site = new URL('https://portfolio.example');
const project: PublishedProject = { id: 'published-case', slug: 'clypse', content: structuredClone(seedProjects[0]!.draft), publishedAt: '2026-10-20T09:00:00.000Z' };

describe('public SEO contract', () => {
  it.each(['ru', 'en'] as const)('gives %s a self canonical, reciprocal generic languages and a localized large JPEG card', locale => {
    const metadata = homeMetadata(site, locale);
    expect(metadata.alternates).toEqual({ canonical: `https://portfolio.example/${locale}`, languages: { ru: 'https://portfolio.example/ru', en: 'https://portfolio.example/en', 'x-default': 'https://portfolio.example/ru' } });
    expect(metadata.openGraph).toMatchObject({ url: `https://portfolio.example/${locale}`, title: metadata.title, description: metadata.description, images: [{ url: `https://portfolio.example/social/portfolio-${locale}-v1.jpg`, width: 1200, height: 630, type: 'image/jpeg' }] });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', title: metadata.title, description: metadata.description });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(JSON.stringify(metadata)).not.toContain('nepomiluu.art');
  });

  it('resolves case languages consistently without query strings or a fake initial publication date', () => {
    const metadata = projectMetadata(site, 'en', project);
    expect(metadata.alternates?.languages).toEqual(localizedUrls(site, '/projects/clypse'));
    expect(metadata.openGraph).toMatchObject({ type: 'article', modifiedTime: project.publishedAt });
    expect(metadata.openGraph).not.toHaveProperty('publishedTime');
    expect(metadata.title).toBe(project.content.seoTitle.en);
    expect(metadata.description).toBe(project.content.seoDescription.en);
  });

  it('follows CMS cover changes instead of keeping a stale slug-based social image', () => {
    expect(projectSocialImage(site, 'ru', project).url).toBe('https://portfolio.example/social/clypse-cover-v1.jpg');
    const changed = structuredClone(project);
    changed.content.cover = { mediaId: 'uploaded-image', alt: { ru: 'Новая обложка', en: 'New cover' } };
    expect(projectSocialImage(site, 'en', changed)).toEqual({ url: 'https://portfolio.example/api/media/uploaded-image/full', type: 'image/webp', alt: 'New cover' });
    changed.content.cover = null;
    expect(projectSocialImage(site, 'en', changed).url).toContain('/portfolio-en-v1.jpg');
  });

  it('never marks local demonstration content as indexable', () => {
    for (const metadata of [homeMetadata(site, 'ru', true), projectMetadata(site, 'en', project, true)]) {
      expect(metadata.robots).toEqual({ index: false, follow: false });
    }
  });

  it('links the visible author and case using stable IDs without invented personal facts', () => {
    const home = homeStructuredData(site, 'en');
    const author = home['@graph'].find(item => item['@type'] === 'Person');
    expect(author).toMatchObject({ '@id': 'https://portfolio.example/#person', name: 'Uliana Nepomilueva', sameAs: ['https://t.me/nepomiluu', 'https://vk.com/unepomilueva'] });
    expect(author).not.toHaveProperty('awards');
    expect(author).not.toHaveProperty('address');
    const work = projectStructuredData(site, 'en', project)['@graph'].find(item => item['@type'] === 'CreativeWork');
    expect(work).toMatchObject({ name: project.content.title.en, creator: { '@id': author!['@id'] }, dateModified: project.publishedAt, inLanguage: 'en' });
  });

  it('keeps hostile CMS text inside JSON rather than allowing an HTML script boundary', () => {
    const data = { name: '</script><script>alert("x")</script>', description: 'A < B & C' };
    const serialized = serializeStructuredData(data);
    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized)).toEqual(data);
  });
});
