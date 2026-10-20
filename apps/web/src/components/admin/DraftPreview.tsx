'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { imageUrl, type CaseBlock, type ImageRef, type Locale, type PublishedProject } from '@portfolio/contracts';
import { useAdmin } from './AdminShell';
import { errorMessage } from './api';
import { ErrorPanel } from './Fields';
import styles from './admin.module.css';

export function DraftPreview({ id, locale }: { id: string; locale: Locale }) {
  const { api } = useAdmin();
  const [project, setProject] = useState<PublishedProject | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let live = true; api<PublishedProject>(`/projects/${encodeURIComponent(id)}/preview`).then(result => { if (live) setProject(result); }).catch(error => { if (live) setError(errorMessage(error)); }); return () => { live = false; }; }, [api, id]);
  return <><div className={styles.previewBanner}><div><strong>Предпросмотр черновика · {locale.toUpperCase()}</strong><p>Виден только после входа. На сайте остаётся опубликованная версия.</p></div><div className={styles.actions}><Link className={styles.secondary} href={`/admin/preview/${encodeURIComponent(id)}?locale=${locale === 'ru' ? 'en' : 'ru'}`}>{locale === 'ru' ? 'English' : 'Русский'}</Link><Link className={styles.primary} href={`/admin/projects/${encodeURIComponent(id)}`}>Вернуться в редактор →</Link></div></div>{error && <ErrorPanel message={error} />}{!project && !error && <p role="status">Собираем предпросмотр…</p>}{project && <article className={styles.casePreview} lang={locale}><header><p className={styles.eyebrow}>{project.content.category[locale]}</p><h1>{project.content.title[locale] || '…'}</h1><p className={styles.previewSummary}>{project.content.summary[locale]}</p><dl>{(['role', 'period', 'status'] as const).map(field => <div key={field}><dt>{locale === 'ru' ? { role: 'Роль', period: 'Период', status: 'Статус' }[field] : { role: 'Role', period: 'Period', status: 'Status' }[field]}</dt><dd>{project.content[field][locale]}</dd></div>)}</dl></header>{project.content.cover && <PreviewImage image={project.content.cover} locale={locale} />}{project.content.blocks.map(block => <PreviewBlock key={block.id} block={block} locale={locale} />)}</article>}</>;
}

function PreviewImage({ image, locale }: { image: ImageRef; locale: Locale }) { return image.mediaId ? <img src={imageUrl(image)} alt={image.alt[locale]} loading="lazy" className={styles.previewImage} /> : <div className={styles.emptyImage}>Изображение ещё не выбрано</div>; }
function PreviewBlock({ block, locale }: { block: CaseBlock; locale: Locale }) {
  switch (block.type) {
    case 'text': return <section className={styles.previewText}><h2>{block.title[locale]}</h2><p>{block.body[locale]}</p></section>;
    case 'image': return <figure><PreviewImage image={block.image} locale={locale} /><figcaption>{block.caption[locale]}</figcaption></figure>;
    case 'gallery': return <figure><div className={styles.previewGallery}>{block.images.map((image, index) => <PreviewImage key={index} image={image} locale={locale} />)}</div><figcaption>{block.caption[locale]}</figcaption></figure>;
    case 'split': return <section className={styles.previewSplit}><PreviewImage image={block.image} locale={locale} /><div><h2>{block.title[locale]}</h2><p>{block.body[locale]}</p></div></section>;
    case 'comparison': return <figure><div className={styles.previewGallery}><div><small>{locale === 'ru' ? 'До' : 'Before'}</small><PreviewImage image={block.before} locale={locale} /></div><div><small>{locale === 'ru' ? 'После' : 'After'}</small><PreviewImage image={block.after} locale={locale} /></div></div><figcaption>{block.caption[locale]}</figcaption></figure>;
    case 'annotated': return <figure><div className={styles.annotationCanvas}><PreviewImage image={block.image} locale={locale} />{block.annotations.map((annotation, index) => <span key={annotation.id} className={styles.annotationPin} style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%` }}>{index + 1}</span>)}</div><figcaption>{block.caption[locale]}</figcaption><ol>{block.annotations.map(annotation => <li key={annotation.id}>{annotation.text[locale]}</li>)}</ol></figure>;
  }
}
