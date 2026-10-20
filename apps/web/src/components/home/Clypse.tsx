'use client';

import Link from 'next/link';
import type { CSSProperties, SyntheticEvent } from 'react';
import { imageUrl, type Locale, type PublishedProject, type StoryStage } from '@portfolio/contracts';
import { Arrow } from '../icons';
import styles from './Clypse.module.css';

const fallbackStages: StoryStage[] = [
  { label: { ru: 'Контекст', en: 'Context' }, title: { ru: 'Одно пространство. Разный контент.', en: 'One workspace. Different kinds of content.' }, body: { ru: 'Заметки, документы и медиа в одном рабочем пространстве с ИИ.', en: 'Notes, documents and media in one AI workspace.' }, image: null, annotations: [] },
  { label: { ru: 'Сценарий', en: 'Flow' }, title: { ru: 'От первого входа — к работе.', en: 'From the first visit to everyday work.' }, body: { ru: 'Рабочее пространство, онбординг и ключевые сценарии MVP.', en: 'The workspace, onboarding and core MVP flows.' }, image: null, annotations: [] },
  { label: { ru: 'Решение', en: 'Solution' }, title: { ru: 'Связать экраны общей логикой.', en: 'Connect screens through a shared logic.' }, body: { ru: 'Компоненты, дизайн-система и адаптивные версии.', en: 'Components, a design system and responsive layouts.' }, image: null, annotations: [] },
];

function headlineParts(headline: string, locale: Locale): [string, string] {
  if (!headline || headline === 'От действия — к системе.' || headline === 'From an action to a system.') return locale === 'ru' ? ['От действия —', 'к системе.'] : ['From an action —', 'to a system.'];
  const separator = headline.indexOf('—');
  return separator >= 0 ? [headline.slice(0, separator + 1).trim(), headline.slice(separator + 1).trim()] : [headline, ''];
}

function registerImageAspect(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.naturalWidth && image.naturalHeight) image.parentElement?.style.setProperty('--image-aspect', String(image.naturalWidth / image.naturalHeight));
}

export function Clypse({ locale, project }: { locale: Locale; project: PublishedProject | null }) {
  const ru = locale === 'ru';
  const stages = project?.content.home.stages.length ? project.content.home.stages.slice(0, 3) : fallbackStages;
  const headline = project?.content.home.headline[locale].trim() || '';
  const [firstLine, secondLine] = headlineParts(headline, locale);
  const classicTitle = !headline || headline === 'От действия — к системе.' || headline === 'From an action to a system.';
  return <section id="projects" className={styles.scene} data-scene="clypse" data-pin="180" aria-labelledby="clypse-title">
    <div className={styles.topline}><p><span>02</span><span aria-hidden="true">/</span>{ru ? 'Как я думаю' : 'How I think'}</p>{project && <Link href={`/${locale}/projects/${project.slug}`} className={styles.caseLink}>{ru ? 'Смотреть кейс' : 'View case'}<Arrow diagonal /></Link>}</div>
    <div className={styles.masthead} data-classic={classicTitle ? 'true' : undefined}>
      <h2 id="clypse-title" data-classic={classicTitle ? 'true' : undefined}><span>{classicTitle ? firstLine.replace(/\s*—$/, '') : firstLine}</span>{secondLine && <em>{secondLine}</em>}</h2>
      <span className={styles.progressLine} aria-hidden="true"><i /></span>
    </div>
    <div className={styles.stageBar}><p>{project?.content.home.subline[locale] || 'CLYPSE / AI WORKSPACE'}</p><nav aria-label={ru ? 'Этапы работы над проектом' : 'Project stages'}>{stages.map((stage, index) => <a key={index} href={`#clypse-stage-${index}`} data-step={index} aria-controls={`clypse-stage-${index}`} aria-current={index === 0 ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{stage.label[locale].replace(/^\d+\s*\/\s*/, '')}</a>)}</nav></div>
    <div className={styles.stages}>{stages.map((stage, index) => <article id={`clypse-stage-${index}`} data-stage={index} data-active={index === 0 ? 'true' : undefined} key={index} className={styles.stage} aria-label={`${String(index + 1).padStart(2, '0')} / ${stage.label[locale].replace(/^\d+\s*\/\s*/, '')}`}>
      {stage.image ? <figure className={styles.screen}><div className={styles.screenFrame}><div className={styles.screenMedia}><img src={imageUrl(stage.image)} alt={stage.image.alt[locale]} loading="lazy" onLoad={registerImageAspect} />{stage.annotations.map((annotation, annotationIndex) => <details className={styles.annotation} key={annotation.id} style={{ '--annotation-x': `${annotation.x * 100}%`, '--annotation-y': `${annotation.y * 100}%` } as CSSProperties} data-side={annotation.y > .6 ? 'above' : 'below'}><summary aria-label={`${ru ? 'Пояснение' : 'Annotation'} ${annotationIndex + 1}: ${annotation.text[locale]}`}>{annotationIndex + 1}</summary><p>{annotation.text[locale]}</p></details>)}</div></div><figcaption><strong>{stage.title[locale]}</strong><span>{stage.body[locale]}</span></figcaption></figure> : <div className={styles.reservedFrame}><p className={styles.reservedLabel}>{project?.content.title[locale].split(' — ')[0] || 'Clypse'}</p><div className={styles.stageCopy}><h3>{stage.title[locale]}</h3><p>{stage.body[locale]}</p></div><p className={styles.materialNote}>{ru ? 'Описание по резюме. Изображения проекта ещё не добавлены.' : 'Description based on the CV. Project images are still to be added.'}</p></div>}
    </article>)}</div>
  </section>;
}

