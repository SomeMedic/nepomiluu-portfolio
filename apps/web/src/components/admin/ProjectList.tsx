'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createProjectSchema, emptyContent, emptyLocalized, imageUrl, type HomeSelection, type Project } from '@portfolio/contracts';
import { useAdmin } from './AdminShell';
import { AdminApiError, errorDetails, errorMessage } from './api';
import { ErrorPanel, LocalizedField } from './Fields';
import styles from './admin.module.css';

export function ProjectList() {
  const { api } = useAdmin();
  const [projects, setProjects] = useState<Project[]>([]);
  const [home, setHome] = useState<HomeSelection>({ first: null, second: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [attempt, setAttempt] = useState(0);
  const [deleting, setDeleting] = useState('');
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    Promise.all([api<Project[]>('/projects'), api<HomeSelection>('/home')]).then(([items, selected]) => { if (live) { setProjects(items); setHome(selected); } }).catch(error => { if (live) setError(errorMessage(error)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api, attempt]);
  async function remove(project: Project) {
    if (!window.confirm(`Удалить «${project.draft.title.ru || project.slug}» без возможности восстановления?`)) return;
    setDeleting(project.id); setError('');
    try { await api(`/projects/${encodeURIComponent(project.id)}?revision=${project.revision}`, { method: 'DELETE' }); setProjects(items => items.filter(item => item.id !== project.id)); }
    catch (error) { setError(errorMessage(error)); }
    finally { setDeleting(''); }
  }
  const filtered = projects.filter(project => (filter === 'all' || (filter === 'published' ? !!project.publishedAt : !project.publishedAt)) && `${project.draft.title.ru} ${project.draft.title.en} ${project.slug}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className={styles.pageHeading}><div><p className={styles.eyebrow}>Твоя коллекция</p><h1>Истории, которые<br />хочется показать.</h1><p className={styles.muted}>От первого наброска до опубликованного кейса.</p></div><Link href="/admin/projects/new" className={styles.primary}>+ Новый проект</Link></div>
    <div className={styles.listTools}><div className={styles.filters} aria-label="Фильтр проектов">{([['all', 'Все'], ['published', 'На сайте'], ['draft', 'Черновики']] as const).map(([key, label]) => <button key={key} className={filter === key ? styles.filterActive : styles.quiet} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}{key === 'all' && <span>{projects.length}</span>}</button>)}</div><label className={styles.search}><span className={styles.srOnly}>Поиск проектов</span><input type="search" placeholder="Найти проект…" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    {error && <div><ErrorPanel message={error} /><button className={styles.secondary} onClick={() => setAttempt(value => value + 1)}>Попробовать ещё раз</button></div>}
    {loading ? <p role="status">Собираем коллекцию…</p> : filtered.length ? <div className={styles.projectGrid}>{filtered.map(project => { const onHome = home.first === project.id || home.second === project.id; return <article key={project.id} className={styles.projectCard}><Link href={`/admin/projects/${encodeURIComponent(project.id)}`} className={styles.projectCover} aria-label={`Редактировать ${project.draft.title.ru || project.slug}`}>{project.draft.cover ? <img src={imageUrl(project.draft.cover, 'page')} alt={project.draft.cover.alt.ru} loading="lazy" /> : <span>История начинается здесь.</span>}<span className={`${styles.badge} ${project.publishedAt ? styles.publishedBadge : ''}`}>{project.publishedAt ? 'На сайте' : 'Черновик'}</span></Link><div className={styles.projectCardBody}><small className={styles.eyebrow}>{project.draft.category.ru || 'Новый проект'}{onHome ? ' · На главной' : ''}</small><h2><Link href={`/admin/projects/${encodeURIComponent(project.id)}`}>{project.draft.title.ru || project.slug}</Link></h2><p className={styles.muted}>{project.draft.summary.ru || 'Добавьте описание, чтобы рассказать о проекте.'}</p><div className={styles.projectMeta}><span>Изменён {new Date(project.updatedAt).toLocaleDateString('ru-RU')}</span><span>RU + EN</span></div><div className={styles.sectionLine}><Link href={`/admin/projects/${encodeURIComponent(project.id)}`} className={styles.textLink}>Редактировать →</Link><button type="button" className={styles.dangerText} disabled={!!deleting || onHome || !!project.publishedAt} title={onHome ? 'Сначала уберите проект с главной' : project.publishedAt ? 'Сначала снимите проект с публикации' : undefined} onClick={() => remove(project)}>{deleting === project.id ? 'Удаляем…' : 'Удалить'}</button></div></div></article>; })}</div> : <div className={styles.empty}><span className={styles.emptySymbol}>↗</span><h2>{query || filter !== 'all' ? 'Здесь пока пусто' : 'Начнём с первой истории.'}</h2><p>{query ? 'Попробуйте другой поисковый запрос.' : filter !== 'all' ? 'В этой категории пока нет проектов.' : 'Добавьте проект, соберите кейс и опубликуйте его на двух языках.'}</p>{!query && filter === 'all' && <Link href="/admin/projects/new" className={styles.primary}>Создать проект →</Link>}</div>}
  </>;
}

export function CreateProject() {
  const { api } = useAdmin();
  const router = useRouter();
  const [title, setTitle] = useState(emptyLocalized);
  const [slug, setSlug] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<string[]>([]);
  async function create(event: FormEvent) {
    event.preventDefault(); setError(''); setDetails([]);
    const parsed = createProjectSchema.safeParse({ slug, draft: { ...emptyContent(), title } });
    if (!parsed.success) { setError('Проверьте адрес проекта.'); setDetails(parsed.error.issues.map(issue => issue.message)); return; }
    setPending(true);
    try { const project = await api<Project>('/projects', { method: 'POST', body: JSON.stringify(parsed.data) }); router.push(`/admin/projects/${encodeURIComponent(project.id)}`); }
    catch (error) { setError(errorMessage(error)); setDetails(error instanceof AdminApiError ? errorDetails(error.errors) : []); }
    finally { setPending(false); }
  }
  return <><Link href="/admin" className={styles.back}>← Все проекты</Link><div className={styles.pageHeading}><div><p className={styles.eyebrow}>Новая история</p><h1>Дадим ей имя.</h1><p className={styles.muted}>Начните с названия и адреса. Остальное добавим в редакторе.</p></div></div><form className={`${styles.card} ${styles.createCard}`} onSubmit={create}><LocalizedField label="Название проекта" value={title} onChange={setTitle} /><label className={styles.field}>Адрес проекта (slug)<input value={slug} onChange={event => setSlug(event.target.value.toLowerCase())} placeholder="my-project" required minLength={2} maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" autoComplete="off" spellCheck={false} /><span className={styles.hint}>Латинские буквы, цифры и дефисы. Один адрес для RU и EN.</span></label>{error && <ErrorPanel message={error} details={details} />}<div className={styles.actions}><button className={styles.primary} type="submit" disabled={pending}>{pending ? 'Создаём…' : 'Создать черновик →'}</button><Link className={styles.quiet} href="/admin">Отмена</Link></div></form></>;
}
