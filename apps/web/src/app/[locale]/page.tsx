import type { Metadata } from 'next';
import type { Locale } from '@portfolio/contracts';
import { getHome, getSiteUrl } from '@/lib/content';
import { SiteHeader } from '@/components/site-header';
import { ContactFooter } from '@/components/contact-footer';
import { Home } from '@/components/home/Home';
export async function generateMetadata({params}: {params:Promise<{locale:Locale}>}):Promise<Metadata>{const{locale}=await params;const site=getSiteUrl().origin;return {title:locale==='ru'?'Ульяна Непомилуева — UX/UI & Product Designer':'Uliana Nepomilueva — UX/UI & Product Designer',description:locale==='ru'?'От сложных сценариев — к понятным продуктам. SaaS, B2B/B2C, e-commerce и MedTech.':'From complex scenarios to clear products. SaaS, B2B/B2C, e-commerce and MedTech.',alternates:{canonical:`${site}/${locale}`,languages:{ru:`${site}/ru`,en:`${site}/en`}},openGraph:{type:'website',locale:locale==='ru'?'ru_RU':'en_US',images:[`${site}/og.svg`]}}}
export default async function HomePage({params}:{params:Promise<{locale:Locale}>}){const{locale}=await params;const projects=await getHome();return <><a className="skip" href="#main-content">{locale==='ru'?'К содержимому':'Skip to content'}</a><div id="top"/><SiteHeader locale={locale}/><main id="main-content" className="siteMain"><Home locale={locale} projects={projects}/></main><ContactFooter locale={locale}/></>}
