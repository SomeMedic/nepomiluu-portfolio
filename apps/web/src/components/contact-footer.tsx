import type { Locale } from '@portfolio/contracts';
import { Arrow } from './icons';
import styles from './contact-footer.module.css';
export function ContactFooter({ locale }: { locale: Locale }) {
  const ru = locale === 'ru';
  return <footer id="contacts" data-home-footer data-locale={locale} className={styles.footer}>
    <div data-footer-reveal className={styles.top}><span>{ru ? 'Связаться' : 'Get in touch'}</span><div /></div>
    <div data-footer-reveal className={styles.spread}>
      <h2><span>{ru ? 'Начнём' : 'Let’s start'}</span><em>{ru ? 'с разговора.' : 'a conversation.'}</em></h2>
      <div className={styles.contacts}>
        <a href="https://t.me/nepomiluu" target="_blank" rel="noopener noreferrer"><span className={styles.label}>Telegram</span><span className={styles.handle}>@nepomiluu<Arrow diagonal /></span></a>
        <a href="https://vk.com/unepomilueva" target="_blank" rel="noopener noreferrer"><span className={styles.label}>{ru ? 'ВКонтакте' : 'VK'}</span><span className={`${styles.handle} ${styles.vk}`}>@unepomilueva<Arrow diagonal /></span></a>
        <a href="mailto:unepomilueva@mail.ru"><span className={styles.label}>Email</span><span className={styles.email}>unepomilueva@mail.ru</span></a>
        <a className={styles.resume} href="/Uliana_Nepomilueva_UX_UI_Product_Designer_CV.pdf" target="_blank" rel="noopener noreferrer">{ru ? 'Резюме PDF' : 'CV · PDF in Russian'}<Arrow down /></a>
      </div>
    </div>
    <div data-footer-reveal className={styles.bottom}><p><strong>{ru ? 'Ульяна Непомилуева' : 'Uliana Nepomilueva'}</strong><span>UX/UI & Product Designer</span></p><a href={`/${locale}`} className={styles.brand}>uliana<span>.</span></a><span>© 2026</span><a href="#top" className="textLink"><span>{ru ? 'Наверх' : 'Back to top'}</span><Arrow down className={styles.up} /></a></div>
  </footer>;
}
