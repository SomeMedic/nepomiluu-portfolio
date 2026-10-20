'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { publicationErrors, type Project, type ProjectContent } from '@portfolio/contracts';
import { useAdmin } from './AdminShell';
import { AdminApiError, errorDetails, errorMessage, isRevisionConflict } from './api';
import { ErrorPanel, LocalizedField } from './Fields';
import { ImageField } from './MediaPicker';
import { BlockList, StageEditor } from './BlockEditor';
import { useDraft } from './useDraft';
import styles from './admin.module.css';

const saveLabels = { saved: 'Все изменения сохранены', dirty: 'Есть несохранённые изменения', saving: 'Сохраняем черновик…', error: 'Не удалось сохранить', conflict: 'Конфликт версий' };
const fieldLabels: Record<string, string> = { title: 'Название', summary: 'Краткое описание', category: 'Категория', role: 'Роль', period: 'Период', status: 'Статус', seoTitle: 'SEO-заголовок', seoDescription: 'SEO-описание', cover: 'Обложка', blocks: 'Блоки кейса', alt: 'Альтернативный текст', home: 'Главная', stages: 'Этапы', label: 'Метка', body: 'Текст', caption: 'Подпись', image: 'Изображение', annotation: 'Пометка', ru: 'RU', en: 'EN' };
function publicationDetail(path: string) { return path.split('.').map(part => fieldLabels[part] || part).join(' → '); }

export function ProjectEditor({ id }: { id: string }) {
  const { api } = useAdmin();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let live = true; setError(''); api<Project>(`/projects/${encodeURIComponent(id)}`).then(result => { if (live) setProject(result); }).catch(error => { if (live) setError(errorMessage(error)); }); return () => { live = false; }; }, [id, api, attempt]);
  if (error) return <><Link href="/admin" className={styles.back}>← Все проекты</Link><ErrorPanel message={error} /><button className={styles.secondary} onClick={() => setAttempt(value => value + 1)}>Попробовать ещё раз</button></>;
  if (!project) return <p role="status">Открываем черновик…</p>;
  return <LoadedEditor key={project.id} project={project} />;
}

function LoadedEditor({ project }: { project: Project }) {
  const { api } = useAdmin();
  const draft = useDraft(project);
  const [tab, setTab] = useState<'about' | 'case' | 'home' | 'seo'>('about');
  const [publishedAt, setPublishedAt] = useState(project.publishedAt);
  const [slugLocked, setSlugLocked] = useState(!!project.firstPublishedAt);
  const [action, setAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionDetails, setActionDetails] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const content = draft.document.draft;
  function update<K extends keyof ProjectContent>(key: K, value: ProjectContent[K]) { draft.setDocument(document => ({ ...document, draft: { ...document.draft, [key]: value } })); }
  async function publish() {
    setActionError(''); setActionDetails([]); setNotice(''); setAction('publish');
    try {
      const errors = publicationErrors(content);
      if (errors.length) { setActionError('Заполните обе языковые версии перед публикацией.'); setActionDetails(errors.map(publicationDetail)); return; }
      if (!await draft.save()) { setActionError('Сначала сохраните черновик и устраните ошибки сохранения.'); return; }
      const result = await api<Project>(`/projects/${encodeURIComponent(project.id)}/publish`, { method: 'POST', body: JSON.stringify({ revision: draft.getRevision() }) });
      draft.setServerRevision(result.revision); setPublishedAt(result.publishedAt); setSlugLocked(true); setNotice('Обе языковые версии опубликованы. Сайт показывает новый снимок проекта.');
    } catch (error) { if (isRevisionConflict(error)) draft.reportConflict(); setActionError(errorMessage(error)); setActionDetails(error instanceof AdminApiError ? errorDetails(error.errors) : []); }
    finally { setAction(''); }
  }
  async function unpublish() {
    if (!window.confirm('Снять проект с публикации? Он исчезнет с сайта. Если проект выбран для главной, сначала измените выбор в разделе «Главная».')) return;
    setActionError(''); setActionDetails([]); setNotice(''); setAction('unpublish');
    try {
      if (!await draft.save()) { setActionError('Сначала сохраните черновик.'); return; }
      const result = await api<Project>(`/projects/${encodeURIComponent(project.id)}/unpublish`, { method: 'POST', body: JSON.stringify({ revision: draft.getRevision() }) });
      draft.setServerRevision(result.revision); setPublishedAt(null); setNotice('Проект снят с публикации. Черновик сохранён.');
    } catch (error) { if (isRevisionConflict(error)) draft.reportConflict(); setActionError(errorMessage(error)); setActionDetails(error instanceof AdminApiError ? errorDetails(error.errors) : []); }
    finally { setAction(''); }
  }
  async function preview(locale: 'ru' | 'en') {
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    setAction('preview'); setActionError('');
    try {
      if (!await draft.save()) { previewWindow?.close(); setActionError('Сначала сохраните черновик. Предпросмотр показывает сохранённую версию.'); return; }
      const url = `/admin/preview/${encodeURIComponent(project.id)}?locale=${locale}`;
      if (previewWindow) previewWindow.location.replace(url);
      else window.location.assign(url);
    } finally { setAction(''); }
  }
  return <><Link href="/admin" className={styles.back}>← Все проекты</Link>
    <div className={styles.pageHeading}><div><p className={styles.eyebrow}>Редактор проекта</p><h1>{content.title.ru || 'Новый проект'}</h1><p className={styles.muted}>{publishedAt ? `На сайте · ${new Date(publishedAt).toLocaleDateString('ru-RU')}` : 'Пока только в черновике'}<span className={styles.separator}>/</span>Ревизия {draft.revision}</p></div><div className={styles.actions}><button type="button" className={styles.secondary} disabled={!!action || draft.state === 'conflict'} onClick={() => preview('ru')}>Превью RU ↗</button><button type="button" className={styles.secondary} disabled={!!action || draft.state === 'conflict'} onClick={() => preview('en')}>Превью EN ↗</button></div></div>
    <div className={styles.editorBar}><div className={styles.saveStatus} role="status" aria-live="polite"><span className={`${styles.statusDot} ${draft.state === 'error' || draft.state === 'conflict' ? styles.statusError : draft.state === 'saved' ? styles.statusSaved : styles.statusPending}`} />{saveLabels[draft.state]}</div><div className={styles.actions}><button type="button" className={styles.quiet} disabled={draft.state === 'saving' || draft.state === 'conflict' || !!action} onClick={() => { void draft.save(); }}>Сохранить сейчас</button><button type="button" className={styles.primary} onClick={publish} disabled={!!action || draft.state === 'conflict'}>{action === 'publish' ? 'Публикуем…' : publishedAt ? 'Обновить публикацию ↗' : 'Опубликовать RU + EN ↗'}</button></div></div>
    {draft.message && <div className={styles.feedback}><ErrorPanel message={draft.message} details={draft.details} /><div className={styles.actions}><button type="button" className={styles.secondary} onClick={draft.downloadCopy}>Скачать копию моих изменений</button>{draft.state === 'conflict' ? <button type="button" className={styles.secondary} onClick={() => { void draft.reload(); }}>Загрузить актуальную версию</button> : <button type="button" className={styles.secondary} onClick={() => { void draft.save(); }}>Повторить сохранение</button>}</div></div>}
    {actionError && <ErrorPanel message={actionError} details={actionDetails} />}{notice && <p className={styles.success} role="status">{notice}</p>}
    <div className={styles.tabs} role="tablist" aria-label="Разделы проекта">{([['about', 'О проекте'], ['case', `Кейс · ${content.blocks.length}`], ['home', 'История на главной'], ['seo', 'SEO и адрес']] as const).map(([key, title]) => <button type="button" role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`} id={`tab-${key}`} key={key} onClick={() => setTab(key)}>{title}</button>)}</div>
    <fieldset disabled={!!action} className={styles.editorPanel} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === 'about' && <><div className={styles.panelHeading}><h2>Первое впечатление</h2><p>Главные слова о проекте. Все поля можно менять в любом порядке — черновик сохраняется автоматически.</p></div><LocalizedField label="Название проекта" value={content.title} onChange={value => update('title', value)} required /><LocalizedField label="Краткое описание" value={content.summary} onChange={value => update('summary', value)} multiline required />{(['category', 'role', 'period', 'status'] as const).map(field => <LocalizedField key={field} label={fieldLabels[field]!} value={content[field]} onChange={value => update(field, value)} required />)}<ImageField label="Обложка проекта" value={content.cover} onChange={value => update('cover', value)} optional /></>}
      {tab === 'case' && <><div className={styles.panelHeading}><h2>История в деталях</h2><p>Соберите кейс из текста, изображений и акцентов. Порядок блоков задаёт ритм истории.</p></div><BlockList blocks={content.blocks} onChange={blocks => update('blocks', blocks)} /></>}
      {tab === 'home' && <><div className={styles.panelHeading}><h2>История на главной</h2><p>Короткое вступление и три ключевых этапа. Эти поля видны, когда проект выбран для главной страницы.</p></div><LocalizedField label="Крупный заголовок" value={content.home.headline} onChange={headline => update('home', { ...content.home, headline })} /><LocalizedField label="Подзаголовок" value={content.home.subline} onChange={subline => update('home', { ...content.home, subline })} multiline /><StageEditor stages={content.home.stages} onChange={stages => update('home', { ...content.home, stages })} /></>}
      {tab === 'seo' && <><div className={styles.panelHeading}><h2>Адрес и поиск</h2><p>Адрес один для обеих языковых версий. SEO-поля описывают проект в поиске и при отправке ссылки.</p></div><label className={styles.field}>Адрес проекта (slug)<input value={draft.document.slug} onChange={event => draft.setDocument(document => ({ ...document, slug: event.target.value }))} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" minLength={2} maxLength={80} spellCheck={false} disabled={slugLocked} /><span className={styles.hint}>{slugLocked ? 'После первой публикации адрес закреплён, чтобы сохранить ссылки на проект.' : 'Латинские буквы, цифры и дефисы. Например: clypse-product-design. После первой публикации адрес закрепляется.'}</span></label><LocalizedField label="SEO-заголовок" value={content.seoTitle} onChange={value => update('seoTitle', value)} required /><LocalizedField label="SEO-описание" value={content.seoDescription} onChange={value => update('seoDescription', value)} multiline required /><div className={styles.searchPreview}><small>Пример в поиске · RU</small><p>{content.seoTitle.ru || content.title.ru || 'Название проекта'}</p><span>/ru/projects/{draft.document.slug}</span><div>{content.seoDescription.ru || 'Краткое описание проекта появится здесь.'}</div></div></>}
    </fieldset>
    {publishedAt && <div className={styles.unpublish}><div><h3>Управление публикацией</h3><p className={styles.muted}>Черновик и опубликованная версия хранятся отдельно.</p></div><button type="button" className={styles.dangerText} disabled={!!action} onClick={unpublish}>{action === 'unpublish' ? 'Снимаем…' : 'Снять с публикации'}</button></div>}
  </>;
}

