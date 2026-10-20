export const documentLanguageHeader = 'x-portfolio-document-language';

/** The CMS stays Russian; only the public /en route tree uses English. */
export function documentLanguage(pathname: string): 'ru' | 'en' {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ru';
}
