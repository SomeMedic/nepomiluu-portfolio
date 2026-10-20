import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
// This installed Next release retains the older name for its Proxy matcher test helper.
import { unstable_doesMiddlewareMatch as doesProxyMatch } from 'next/experimental/testing/server';
import { documentLanguage, documentLanguageHeader } from './app/document-language';
import { config, proxy } from './proxy';

describe('document language routing', () => {
  it.each([
    ['/', 'ru'], ['/ru', 'ru'], ['/ru/projects/case', 'ru'],
    ['/en', 'en'], ['/en/', 'en'], ['/en/projects/case', 'en'],
    ['/admin', 'ru'], ['/admin/preview/case', 'ru'], ['/english', 'ru'],
  ] as const)('maps %s to %s', (pathname: string, language: 'ru' | 'en') => {
    expect(documentLanguage(pathname)).toBe(language);
  });

  it.each(['/ru', '/en/projects/case', '/admin', '/admin/home', '/'])('covers page route %s', (url: string) => {
    expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
  });

  it.each(['/api/admin/session', '/_next/static/chunk.js', '/assets/cover.webp', '/fonts/fonts.css'])('skips non-page route %s', (url: string) => {
    expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
  });

  it.each([['/ru', 'ru'], ['/en/projects/case', 'en'], ['/admin', 'ru']] as const)('derives %s from its URL and replaces untrusted language headers', (pathname: string, language: 'ru' | 'en') => {
    const request = new NextRequest(`https://portfolio.example${pathname}`, {
      headers: { [documentLanguageHeader]: language === 'en' ? 'ru' : 'en', cookie: 'portfolio_session=opaque' },
    });
    const response = proxy(request);
    expect(response.headers.get(`x-middleware-request-${documentLanguageHeader}`)).toBe(language);
    expect(response.headers.get('x-middleware-request-cookie')).toBe('portfolio_session=opaque');
    expect(response.headers.get(documentLanguageHeader)).toBeNull();
    expect(request.headers.get(documentLanguageHeader)).not.toBe(language);
  });
});
