import type { Locale } from '@portfolio/contracts';
import { Arrow } from '../icons';
import styles from './Hero.module.css';

export function Hero({ locale }: { locale: Locale }) {
  const ru = locale === 'ru';
  return <section className={styles.hero} data-hero data-locale={locale} aria-labelledby="hero-title">
    <div className={styles.masthead}>
      <h1 id="hero-title" data-hero-title><span>{ru ? 'Ульяна' : 'Uliana'}</span><span>{ru ? 'Непомилуева' : 'Nepomilueva'}</span></h1>
      <p className={styles.role} data-hero-detail>UX/UI &amp; PRODUCT DESIGNER<span aria-hidden="true" /></p>
    </div>
    <div className={styles.bottom}>
      <div className={styles.intro} data-hero-detail>
        <p className={styles.disciplines}>{ru ? <>Сценарии.<br />Интерфейсы.<br />Системы.</> : <>Journeys.<br />Interfaces.<br />Systems.</>}</p>
        <span className={styles.shortRule} aria-hidden="true" />
        <p className={styles.logic}>{ru ? <>Логика внутри.<br />Характер снаружи.</> : <>Logic within.<br />Character throughout.</>}</p>
        <a className={styles.projectButton} href="#projects">{ru ? 'Смотреть проекты' : 'View projects'}<Arrow /></a>
        <a className={styles.below} href="#projects">{ru ? 'Проекты — ниже' : 'Projects below'}<Arrow down /></a>
      </div>
      <div className={styles.about} data-hero-detail>
        <p className={styles.eyebrow}>{ru ? 'Обо мне' : 'About me'}</p>
        <h2>{ru ? <><span>От сложных сценариев —</span><span>к понятным</span><span>продуктам.</span></> : <><span>From complex journeys —</span><span>to clear</span><span>products.</span></>}</h2>
        <p className={styles.description}>{ru ? <><span>Я UX/UI- и продуктовый дизайнер.</span>{' '}<span>Проектирую цифровые продукты: от сценариев</span>{' '}<span>и структуры до интерфейсов и дизайн-систем.</span>{' '}<span>Соединяю системное мышление и внимание к деталям.</span></> : <>I’m a UX/UI and product designer.<br />I design digital products: from journeys and structure to interfaces and design systems.<br />I connect systematic thinking with attention to detail.</>}</p>
        <dl className={styles.facts}>
          <div><dt>{ru ? '3+ года' : '3+ years'}</dt><dd>{ru ? 'в дизайне' : 'in design'}</dd></div>
          <div><dt>B2B / B2C</dt><dd>{ru ? 'цифровые продукты' : 'digital products'}</dd></div>
          <div><dt>SaaS · E-commerce</dt><dd>MedTech</dd></div>
        </dl>
      </div>
      <div className={styles.portrait} data-hero-detail>
        <div className={styles.portraitWindow}>
        <img className={styles.portraitImage} data-portrait src="/assets/portrait-source-lossless.webp" alt={ru ? 'Ульяна Непомилуева' : 'Uliana Nepomilueva'} width={960} height={1280} fetchPriority="high" /></div>
      </div>
    </div>
  </section>;
}

