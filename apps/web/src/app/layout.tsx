import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { DocumentLanguage } from './DocumentLanguage';
import { documentLanguageHeader } from './document-language';
import './globals.css';
export const metadata: Metadata = { title: 'Ульяна Непомилуева — UX/UI & Product Designer', description: 'От сложных сценариев — к понятным продуктам. Портфолио UX/UI и продуктового дизайнера Ульяны Непомилуевой.' };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = (await headers()).get(documentLanguageHeader) === 'en' ? 'en' : 'ru';
  return <html lang={language}><head><link rel="stylesheet" href="/fonts/fonts.css" /></head><body><DocumentLanguage />{children}</body></html>;
}
