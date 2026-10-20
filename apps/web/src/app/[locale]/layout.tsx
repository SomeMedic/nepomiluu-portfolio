import { notFound } from 'next/navigation';
import { locales, type Locale } from '@portfolio/contracts';
export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{locale:string}> }) { const {locale}=await params; if(!locales.includes(locale as Locale)) notFound(); return <div lang={locale}>{children}</div>; }
