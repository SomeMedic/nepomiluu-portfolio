import Link from 'next/link';
import type { Locale } from '@portfolio/contracts';
import styles from './site-header.module.css';
export function SiteHeader({ locale, slug }: { locale: Locale; slug?: string }) {
  const ru = locale === 'ru'; const home = `/${locale}`;
  return <header className={styles.header}>
    <Link href={home} className={styles.brand} aria-label={ru ? 'Ульяна — главная' : 'Uliana — home'}>uliana<span>.</span></Link>
    <nav aria-label={ru ? 'Главная навигация' : 'Main navigation'}>
      <Link href={`${home}#projects`}>{ru ? 'Проекты' : 'Projects'}</Link>
      <Link href={`${home}#about`}>{ru ? 'Обо мне' : 'About'}</Link>
      <a href="/Uliana_Nepomilueva_UX_UI_Product_Designer_CV.pdf" target="_blank" rel="noopener noreferrer">{ru ? 'Резюме' : 'CV (RU)'}</a>
      <div className={styles.languages}><Link className="localeSwitch" href={`/ru${slug ? `/projects/${slug}` : ''}`} aria-current={ru ? 'page' : undefined} lang="ru">RU</Link><span>/</span><Link className="localeSwitch" href={`/en${slug ? `/projects/${slug}` : ''}`} aria-current={!ru ? 'page' : undefined} lang="en">EN</Link></div>
      <Link className={styles.contact} href={`${home}#contacts`}>{ru ? 'Связаться' : 'Get in touch'}</Link>
    </nav>
  </header>;
}
