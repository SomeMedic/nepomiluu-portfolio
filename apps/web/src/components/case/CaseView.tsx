'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import { imageUrl, type CaseBlock, type ImageRef, type Locale, type PublishedProject } from '@portfolio/contracts';
import styles from './case.module.css';

const words = {
  ru: { back: 'Все проекты', role: 'Моя роль', period: 'Период', status: 'Статус', contents: 'В этом кейсе', expand: 'Открыть изображение на весь экран', close: 'Закрыть изображение', before: 'До', after: 'После', comparison: 'Положение границы сравнения', annotation: 'Пояснение', image: 'Экран', gallery: 'Экраны', annotated: 'Детали интерфейса', comparisonTitle: 'Сравнение', contact: 'Обсудим вашу задачу?', contactLink: 'Начать разговор', preview: 'Локальный предпросмотр контента. Он не подтверждает публикацию кейса в CMS.', missing: 'Реальные экраны ещё не добавлены', missingBody: 'Текст подготовлен по резюме. Обложка и изображения проекта появятся после добавления исходных материалов; концептуальные макеты не выдаются за интерфейс продукта.' },
  en: { back: 'All projects', role: 'My role', period: 'Period', status: 'Status', contents: 'In this case', expand: 'Open image full screen', close: 'Close image', before: 'Before', after: 'After', comparison: 'Comparison divider position', annotation: 'Annotation', image: 'Screen', gallery: 'Screens', annotated: 'Interface details', comparisonTitle: 'Comparison', contact: 'Have a challenge in mind?', contactLink: 'Start a conversation', preview: 'Local content preview. This does not confirm that the case is published in the CMS.', missing: 'Real screens are still to be added', missingBody: 'The text is based on the CV. The cover and project images will appear once source materials are supplied; conceptual mockups are not presented as product interfaces.' },
};

const imageWords = {
  ru: { fit: 'Вписать', fitLabel: 'Вписать изображение в окно', originalLabel: 'Показать изображение в исходном масштабе 100%', pan: 'Изображение в исходном масштабе. Прокручивайте для просмотра деталей.' },
  en: { fit: 'Fit', fitLabel: 'Fit image to window', originalLabel: 'Show image at its original 100% size', pan: 'Image at original size. Scroll to explore the details.' },
};

type OpenImage = (image: ImageRef, event: MouseEvent<HTMLButtonElement>) => void;

function Paragraphs({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</>;
}

function ImageButton({ image, locale, open, eager = false }: { image: ImageRef; locale: Locale; open: OpenImage; eager?: boolean }) {
  return <button className={styles.imageButton} type="button" onClick={event => open(image, event)} aria-label={`${words[locale].expand}: ${image.alt[locale]}`}><img src={imageUrl(image)} alt={image.alt[locale]} loading={eager ? 'eager' : 'lazy'} decoding="async" /><span className={styles.expandLabel} aria-hidden="true">↗</span></button>;
}

function AnnotatedImage({ block, locale, open, sectionId }: { block: Extract<CaseBlock, { type: 'annotated' }>; locale: Locale; open: OpenImage; sectionId: string }) {
  const [active, setActive] = useState<number | null>(null);
  const toggle = (index: number) => setActive(current => current === index ? null : index);
  return <figure className={styles.figure}>
    <div className={styles.annotationCanvas}>
      <ImageButton image={block.image} locale={locale} open={open} />
      {block.annotations.map((annotation, index) => <button key={annotation.id} type="button" className={`${styles.pin} ${active === index ? styles.activePin : ''}`} style={{ left: `clamp(1.5rem, ${annotation.x * 100}%, calc(100% - 1.5rem))`, top: `clamp(1.5rem, ${annotation.y * 100}%, calc(100% - 1.5rem))` }} aria-label={`${words[locale].annotation} ${index + 1}: ${annotation.text[locale]}`} aria-expanded={active === index} aria-controls={`${sectionId}-annotation-${index}`} onClick={() => toggle(index)}>{index + 1}</button>)}
    </div>
    <figcaption>{block.caption[locale]}</figcaption>
    {block.annotations.length > 0 && <ol className={styles.annotationList}>{block.annotations.map((annotation, index) => <li key={annotation.id}><button type="button" aria-expanded={active === index} aria-controls={`${sectionId}-annotation-${index}`} onClick={() => toggle(index)}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{words[locale].annotation} {index + 1}<span aria-hidden="true">{active === index ? '−' : '+'}</span></button><div id={`${sectionId}-annotation-${index}`} hidden={active !== index}><p>{annotation.text[locale]}</p></div></li>)}</ol>}
  </figure>;
}

function Comparison({ block, locale, open, sectionId }: { block: Extract<CaseBlock, { type: 'comparison' }>; locale: Locale; open: OpenImage; sectionId: string }) {
  const [position, setPosition] = useState(50);
  const t = words[locale];
  return <figure className={styles.figure}>
    <div className={styles.comparisonCanvas}>
      <img src={imageUrl(block.after)} alt={block.after.alt[locale]} loading="lazy" />
      <div className={styles.comparisonBefore} style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><img src={imageUrl(block.before)} alt={block.before.alt[locale]} loading="lazy" /></div>
      <span className={styles.beforeLabel}>{t.before}</span><span className={styles.afterLabel}>{t.after}</span>
      <span className={styles.divider} style={{ left: `${position}%` }} aria-hidden="true"><span>↔</span></span>
    </div>
    <label className={styles.rangeLabel} htmlFor={`${sectionId}-range`}>{t.comparison}<output htmlFor={`${sectionId}-range`}>{position}%</output></label>
    <input className={styles.range} id={`${sectionId}-range`} type="range" min={0} max={100} value={position} aria-valuetext={`${t.before}: ${position}%, ${t.after}: ${100 - position}%`} onChange={event => setPosition(Number(event.target.value))} />
    <div className={styles.comparisonActions}><button type="button" onClick={event => open(block.before, event)}>{t.before} ↗</button><button type="button" onClick={event => open(block.after, event)}>{t.after} ↗</button></div>
    <figcaption>{block.caption[locale]}</figcaption>
  </figure>;
}

function Block({ block, locale, open, sectionId }: { block: CaseBlock; locale: Locale; open: OpenImage; sectionId: string }) {
  switch (block.type) {
    case 'text': return <div className={styles.textBlock}><h2>{block.title[locale]}</h2><div className={styles.prose}><Paragraphs text={block.body[locale]} /></div></div>;
    case 'image': return <figure className={styles.figure}><ImageButton image={block.image} locale={locale} open={open} /><figcaption>{block.caption[locale]}</figcaption></figure>;
    case 'gallery': return <figure className={styles.figure}><div className={styles.gallery}>{block.images.map((image, index) => <ImageButton key={`${image.mediaId}-${index}`} image={image} locale={locale} open={open} />)}</div><figcaption>{block.caption[locale]}</figcaption></figure>;
    case 'split': return <div className={styles.split}><ImageButton image={block.image} locale={locale} open={open} /><div><h2>{block.title[locale]}</h2><div className={styles.prose}><Paragraphs text={block.body[locale]} /></div></div></div>;
    case 'comparison': return <Comparison block={block} locale={locale} open={open} sectionId={sectionId} />;
    case 'annotated': return <AnnotatedImage block={block} locale={locale} open={open} sectionId={sectionId} />;
  }
}

function navigationLabel(block: CaseBlock, locale: Locale): string {
  if (block.type === 'text' || block.type === 'split') return block.title[locale];
  return words[locale][block.type === 'comparison' ? 'comparisonTitle' : block.type];
}

export function CaseView({ project, locale }: { project: PublishedProject; locale: Locale }) {
  const { content } = project;
  const t = words[locale];
  const imageText = imageWords[locale];
  const [activeImage, setActiveImage] = useState<ImageRef | null>(null);
  const [originalSize, setOriginalSize] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const imageViewport = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const dialogTitle = useId();
  const open: OpenImage = (image, event) => { opener.current = event.currentTarget; setOriginalSize(false); setActiveImage(image); };
  useEffect(() => {
    const node = dialog.current;
    if (!activeImage || !node) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.showModal();
    return () => { if (node.open) node.close(); document.body.style.overflow = previousOverflow; };
  }, [activeImage]);
  useEffect(() => { imageViewport.current?.scrollTo(0, 0); }, [activeImage, originalSize]);
  const close = () => { setActiveImage(null); opener.current?.focus(); };
  const trapDialogFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const node = event.currentTarget;
    const focusable = Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) { event.preventDefault(); return; }
    if (focusable.length === 1 || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last) || !node.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };
  const entries = content.blocks.map((block, index) => ({ block, anchor: `case-section-${index + 1}`, label: navigationLabel(block, locale) }));

  return <>
    <main id="main-content" tabIndex={-1} className={styles.case} lang={locale}>
      <span id="main" className={styles.anchorTarget} />
      <article>
        <header className={styles.hero}>
          <Link className={styles.back} href={`/${locale}#projects`}>← {t.back}</Link>
          <p className={styles.eyebrow}>{content.category[locale]}</p>
          <h1>{content.title[locale]}</h1>
          <p className={styles.summary}>{content.summary[locale]}</p>
          <dl className={styles.facts}>{(['role', 'period', 'status'] as const).map(field => <div key={field}><dt>{t[field]}</dt><dd>{content[field][locale]}</dd></div>)}</dl>
        </header>
        {project.id.startsWith('local-preview:') && <p className={styles.preview} role="note">{t.preview}</p>}
        <div className={styles.cover}>{content.cover ? <ImageButton image={content.cover} locale={locale} open={open} eager /> : <div className={styles.missing}><p className={styles.eyebrow}>Clypse / {locale === 'ru' ? 'материалы проекта' : 'project materials'}</p><h2>{t.missing}</h2><p>{t.missingBody}</p></div>}</div>
        <div className={styles.caseLayout}>
          <aside className={styles.sidebar}><nav aria-label={t.contents}><p className={styles.tocTitle}>{t.contents}</p><ol>{entries.map(({ anchor, label }, index) => <li key={anchor}><a href={`#${anchor}`}><span>{String(index + 1).padStart(2, '0')}</span>{label}</a></li>)}</ol></nav></aside>
          <div className={styles.blocks}>{entries.map(({ block, anchor }, index) => <section key={`${block.id}-${index}`} id={anchor} className={styles.block}><Block block={block} locale={locale} open={open} sectionId={anchor} /></section>)}</div>
        </div>
        <div className={styles.caseEnd}><p>{t.contact}</p><a href="#contacts">{t.contactLink} <span aria-hidden="true">↗</span></a><Link href={`/${locale}#projects`}>{t.back} <span aria-hidden="true">↑</span></Link></div>
      </article>
    </main>
    <dialog ref={dialog} className={styles.lightbox} aria-labelledby={dialogTitle} onKeyDown={trapDialogFocus} onCancel={event => { event.preventDefault(); close(); }} onClose={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      {activeImage && <>
        <div className={styles.lightboxHeader}>
          <p id={dialogTitle}>{activeImage.alt[locale]}</p>
          <div className={styles.lightboxControls}>
            <button type="button" onClick={() => setOriginalSize(value => !value)} aria-pressed={originalSize} aria-label={originalSize ? imageText.fitLabel : imageText.originalLabel} title={originalSize ? imageText.fitLabel : imageText.originalLabel}>{originalSize ? imageText.fit : '100%'}</button>
            <button type="button" onClick={close} autoFocus aria-label={t.close}><span className={styles.closeText}>{t.close}</span><span aria-hidden="true">×</span></button>
          </div>
        </div>
        <div ref={imageViewport} className={`${styles.lightboxImage} ${originalSize ? styles.originalSize : ''}`} role="region" aria-label={originalSize ? imageText.pan : t.image} tabIndex={originalSize ? 0 : undefined}>
          <img src={imageUrl(activeImage, 'full')} alt={activeImage.alt[locale]} />
        </div>
      </>}
    </dialog>
  </>;
}
