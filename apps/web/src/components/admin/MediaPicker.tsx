'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { emptyLocalized, imageUrl, type ImageRef, type Media } from '@portfolio/contracts';
import { useAdmin } from './AdminShell';
import { errorMessage } from './api';
import { LocalizedField } from './Fields';
import styles from './admin.module.css';

export function ImageField({ label = 'Изображение', value, onChange, optional = false }: { label?: string; value: ImageRef | null; onChange: (image: ImageRef | null) => void; optional?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className={styles.imageField}><div className={styles.sectionLine}><h4>{label}</h4><div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setOpen(true)}>{value?.mediaId ? 'Заменить изображение' : 'Выбрать изображение'}</button>{optional && value && <button type="button" className={styles.quiet} onClick={() => onChange(null)}>Убрать</button>}</div></div>
    {value?.mediaId ? <div className={styles.selectedImage}><img src={imageUrl(value, 'thumb')} alt={value.alt.ru || 'Выбранное изображение'} loading="lazy" /><div><p className={styles.muted}>Выбрано изображение</p><code>{value.mediaId}</code></div></div> : <div className={styles.emptyImage}>Изображение ещё не выбрано</div>}
    {value && <LocalizedField label="Альтернативный текст" value={value.alt} onChange={alt => onChange({ ...value, alt })} hint="Опишите содержание изображения для людей, использующих экранный диктор. Обе версии нужны для публикации." required />}
    {open && <MediaDialog onClose={() => setOpen(false)} onSelect={media => { onChange({ mediaId: media.id, alt: value?.alt || emptyLocalized() }); setOpen(false); }} />}
  </div>;
}

export function MediaLibrary({ onSelect }: { onSelect?: (media: Media) => void }) {
  const { api } = useAdmin();
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { let live = true; api<Media[]>('/media').then(items => { if (live) setMedia(items); }).catch(error => { if (live) setError(errorMessage(error)); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [api]);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setUploading(true); setError(''); setNotice('');
    try {
      const form = new FormData(); form.append('file', file);
      const item = await api<Media>('/media', { method: 'POST', body: form });
      setMedia(items => [item, ...items.filter(existing => existing.id !== item.id)]);
      setNotice(`«${item.originalName}» загружено.`);
    } catch (error) { setError(errorMessage(error)); }
    finally { setUploading(false); }
  }
  const filtered = media.filter(item => item.originalName.toLowerCase().includes(query.toLowerCase()));
  return <div><div className={styles.libraryTools}><label className={styles.field}>Поиск<input type="search" placeholder="По названию файла" value={query} onChange={event => setQuery(event.target.value)} /></label><label className={`${styles.primary} ${uploading ? styles.disabled : ''}`}><input className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={upload} disabled={uploading} />{uploading ? 'Загружаем…' : '↑ Загрузить изображение'}</label></div><p className={styles.hint}>JPG, PNG, WebP или AVIF. Файл проверяется на сервере и автоматически подготавливается для сайта.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.success}>{notice}</p>}
    {loading ? <p role="status">Загружаем библиотеку…</p> : filtered.length ? <div className={styles.mediaGrid}>{filtered.map(item => <div className={styles.mediaCard} key={item.id}><img src={item.url || `/api/media/${encodeURIComponent(item.id)}/thumb`} alt="" loading="lazy" /><div><strong title={item.originalName}>{item.originalName}</strong><small>{item.width} × {item.height} · {Math.round(item.bytes / 1024)} КБ</small>{onSelect ? <button type="button" className={styles.secondary} onClick={() => onSelect(item)}>Выбрать</button> : <a className={styles.quiet} href={item.url} target="_blank" rel="noreferrer">Открыть ↗</a>}</div></div>)}</div> : <div className={styles.empty}><h3>{query ? 'Ничего не нашлось' : 'Место для новых образов'}</h3><p>{query ? 'Попробуйте другое название.' : 'Загрузите первое изображение, чтобы использовать его в проекте.'}</p></div>}
  </div>;
}

function MediaDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (media: Media) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={styles.dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="media-dialog-title"><div className={styles.dialogHeading}><div><p className={styles.eyebrow}>Медиатека</p><h2 id="media-dialog-title">Выбрать изображение</h2></div><button type="button" onClick={onClose} className={styles.secondary} autoFocus aria-label="Закрыть медиатеку">Закрыть ×</button></div><MediaLibrary onSelect={onSelect} /></dialog>;
}
