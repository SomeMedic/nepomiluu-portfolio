import Link from 'next/link';
import { imageUrl, type Locale, type PublishedProject } from '@portfolio/contracts';
import { Arrow } from '../icons';
import styles from './Fomina.module.css';

export function Fomina({ locale, project }: { locale: Locale; project: PublishedProject | null }) {
  const ru = locale === 'ru';
  const title = project?.content.title[locale].split(' — ')[0] || (ru ? 'Клиника Фомина' : 'Fomin Clinic');
  const stages = project?.content.home.stages.length
    ? project.content.home.stages.slice(0, 3)
    : project?.content.cover ? [{ label: project.content.title, title: project.content.title, body: project.content.summary, image: project.content.cover, annotations: [] }] : [];
  return <section id="fomina" data-scene="fomina" data-pin="180" className={styles.scene} aria-labelledby="fomina-heading">
    <div className="sectionTop"><span><b>03</b> / &nbsp;{ru ? 'Избранные работы' : 'Selected work'}</span><span className="rule" /><span className="meta">MedTech / Web design</span></div>
    <div className={styles.heading}>
      <h2 id="fomina-heading" data-parallax-title>{ru ? 'Внимание.' : 'Attention.'}</h2>
      <div className={styles.meta}>
        <h3>{title}</h3>
        {project && <Link className="textLink" href={`/${locale}/projects/${project.slug}`}><span>{ru ? 'Смотреть кейс' : 'View case'}</span><Arrow diagonal /></Link>}
      </div>
    </div>
    <div className={styles.stages}>{stages.map((stage, index) => <article id={`fomina-stage-${index}`} data-stage={index} data-active={index === 0 ? 'true' : undefined} key={index} className={styles.stage}>
      <figure>
        {stage.image && <Link href={`/${locale}/projects/${project!.slug}`} className={styles.screen} aria-label={`${ru ? 'Открыть кейс' : 'Open case study'}: ${title}`}>
          <img src={imageUrl(stage.image)} alt={stage.image.alt[locale]} width="1586" height="992" loading="lazy" decoding="async" />
        </Link>}
        <figcaption><h3>{stage.title[locale]}</h3><p>{stage.body[locale]}</p></figcaption>
      </figure>
    </article>)}</div>
    <div className={styles.rail}>
      <p className={styles.bottom} data-parallax-bottom>{ru ? <>В каждой<br />детали.</> : <>In every<br />detail.</>}</p>
      <nav aria-label={ru ? 'Этапы знакомства с клиникой' : 'The clinic journey'}>{stages.map((stage, index) => <a key={index} href={`#fomina-stage-${index}`} data-step={index} aria-controls={`fomina-stage-${index}`} aria-current={index === 0 ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{stage.label[locale].replace(/^\d+\s*\/\s*/, '')}</a>)}</nav>
    </div>
  </section>;
}
