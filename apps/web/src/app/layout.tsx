import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { DocumentLanguage } from './DocumentLanguage';
import { documentLanguageHeader } from './document-language';
import './globals.css';
export const metadata: Metadata = {
  title: 'Ульяна Непомилуева — UX/UI и продуктовый дизайнер',
  applicationName: 'uliana.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: '#f8f5ef', colorScheme: 'light' };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = (await headers()).get(documentLanguageHeader) === 'en' ? 'en' : 'ru';
  return <html lang={language}><head><link rel="stylesheet" href="/fonts/fonts.css" /></head><body><DocumentLanguage />{children}</body></html>;
}
