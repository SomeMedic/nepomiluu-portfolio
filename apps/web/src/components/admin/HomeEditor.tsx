'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { homeSelectionSchema, imageUrl, publicationErrors, type HomeSelection, type Project } from '@portfolio/contracts';
import { useAdmin } from './AdminShell';
import { AdminApiError, errorDetails, errorMessage } from './api';
import { ErrorPanel } from './Fields';
import styles from './admin.module.css';

export function HomeEditor() {
  const { api } = useAdmin();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selection, setSelection] = useState<HomeSelection>({ first: null, second: null });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let live = true; setError(''); setLoading(true); Promise.all([api<Project[]>('/projects'), api<HomeSelection>('/home')]).then(([items, home]) => { if (live) { setProjects(items); setSelection(home); } }).catch(error => { if (live) setError(errorMessage(error)); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [api, attempt]);
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setDetails([]); setNotice('');
    const parsed = homeSelectionSchema.safeParse(selection);
    if (!parsed.success) { setError('Выберите два разных опубликованных проекта.'); return; }
    const first = projects.find(project => project.id === selection.first)?.publishedSnapshot;
    if (!first || first.home.stages.length !== 3 || (['ru', 'en'] as const).some(locale => !first.home.headline[locale].trim() || !first.home.subline[locale].trim()) || publicationErrors(first).length) {
      setError('Первой истории нужны заполненное вступление и ровно три этапа на двух языках. Откройте редактор выбранного проекта, заполните раздел «История на главной» и обновите публикацию.'); return;
    }
    setPending(true);
    try { const result = await api<HomeSelection>('/home', { method: 'PUT', body: JSON.stringify(parsed.data) }); setSelection(result); setNotice('Главная обновлена. Новая подборка уже на сайте.'); }
    catch (error) { setError(errorMessage(error)); setDetails(error instanceof AdminApiError ? errorDetails(error.errors) : []); }
    finally { setPending(false); }
  }
  const published = projects.filter(project => !!project.publishedAt);
  return <><div className={styles.pageHeading}><div><p className={styles.eyebrow}>Главная страница</p><h1>Две истории.<br />Твой взгляд на дизайн.</h1><p className={styles.muted}>Выберите проекты и порядок, в котором они встретят посетителя.</p></div><a href="/ru" target="_blank" rel="noreferrer" className={styles.secondary}>Открыть главную ↗</a></div>{error && <ErrorPanel message={error} details={details} />}{notice && <p role="status" className={styles.success}>{notice}</p>}
    {loading ? <p role="status">Загружаем подборку…</p> : <form onSubmit={save}><div className={styles.homeGrid}>{(['first', 'second'] as const).map((position, index) => { const selected = projects.find(project => project.id === selection[position]); const other = position === 'first' ? selection.second : selection.first; return <section key={position} className={styles.homeCard}><p className={styles.eyebrow}>История {String(index + 1).padStart(2, '0')}</p><h2>{position === 'first' ? 'Первое знакомство' : 'Следующая работа'}</h2><label className={styles.field}>Опубликованный проект<select value={selection[position] || ''} required onChange={event => { setSelection(current => ({ ...current, [position]: event.target.value || null })); setNotice(''); }} disabled={pending}><option value="">Выберите проект</option>{published.map(project => <option key={project.id} value={project.id} disabled={project.id === other}>{project.draft.title.ru || project.slug}</option>)}</select></label>{selected ? <><div className={styles.homeImage}>{selected.publishedSnapshot?.cover && <img src={imageUrl(selected.publishedSnapshot.cover, 'page')} alt={selected.publishedSnapshot.cover.alt.ru} />}</div><h3>{selected.publishedSnapshot?.home.headline.ru || selected.draft.title.ru}</h3><p className={styles.muted}>{selected.publishedSnapshot?.home.subline.ru || 'Добавьте вступление в редакторе проекта.'}</p><p className={styles.hint}>Этапов в опубликованной версии: {selected.publishedSnapshot?.home.stages.length || 0} из 3</p><Link href={`/admin/projects/${encodeURIComponent(selected.id)}`} className={styles.textLink}>Редактировать историю и этапы →</Link></> : <div className={styles.emptyImage}>Выберите историю для этого места</div>}</section>; })}</div><div className={styles.card}><div className={styles.sectionLine}><div><h3>Обновить подборку</h3><p className={styles.muted}>Изменение выбора сразу отражается на главной. Содержание берётся из опубликованных версий.</p></div><button type="submit" className={styles.primary} disabled={pending || published.length < 2}>{pending ? 'Сохраняем…' : 'Сохранить главную ↗'}</button></div>{published.length < 2 && <p className={styles.hint}>Чтобы собрать подборку, сначала опубликуйте два проекта.</p>}</div></form>}{error && <button type="button" className={styles.secondary} onClick={() => setAttempt(value => value + 1)}>Загрузить заново</button>}</>;
}

