'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveProjectSchema, type Project, type ProjectContent } from '@portfolio/contracts';
import { useAdmin } from './AdminShell';
import { AdminApiError, errorDetails, errorMessage, isRevisionConflict } from './api';

export interface DraftDocument { slug: string; draft: ProjectContent }
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
export function draftFingerprint(document: DraftDocument) { return JSON.stringify(document); }

export function useDraft(project: Project) {
  const { api } = useAdmin();
  const initial = { slug: project.slug, draft: project.draft };
  const [document, setDocument] = useState<DraftDocument>(initial);
  const [state, setState] = useState<SaveState>('saved');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState<string[]>([]);
  const [revision, setRevision] = useState(project.revision);
  const latest = useRef(document);
  const serverRevision = useRef(project.revision);
  const saved = useRef(draftFingerprint(initial));
  const conflict = useRef(false);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => Promise<boolean>>(async () => true);
  const mounted = useRef(true);
  const currentFingerprint = draftFingerprint(document);
  const dirty = currentFingerprint !== saved.current;

  const save = useCallback((): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    if (inFlight.current) return inFlight.current.then(ok => ok && draftFingerprint(latest.current) !== saved.current ? saveRef.current() : ok);
    if (conflict.current) return Promise.resolve(false);
    const current = latest.current;
    const fingerprint = draftFingerprint(current);
    if (fingerprint === saved.current) return Promise.resolve(true);
    const parsed = saveProjectSchema.safeParse({ ...current, revision: serverRevision.current });
    if (!parsed.success) {
      setState('error'); setMessage('Черновик пока не сохранён. Заполните обязательные поля блока.');
      setDetails(parsed.error.issues.map(issue => `${issue.path.join('.')} — ${issue.message}`));
      return Promise.resolve(false);
    }
    setState('saving'); setMessage(''); setDetails([]);
    let succeeded = false;
    const operation = (async () => {
      try {
        const result = await api<Project>(`/projects/${encodeURIComponent(project.id)}`, { method: 'PATCH', body: JSON.stringify(parsed.data) });
        serverRevision.current = result.revision;
        saved.current = fingerprint;
        succeeded = true;
        if (mounted.current) { setRevision(result.revision); setState(draftFingerprint(latest.current) === fingerprint ? 'saved' : 'dirty'); }
        return true;
      } catch (error) {
        if (!mounted.current) return false;
        if (isRevisionConflict(error)) {
          conflict.current = true; setState('conflict'); setMessage('Проект изменён в другом окне. Ваши изменения остаются в редакторе. Сохраните копию перед загрузкой актуальной версии.');
        } else { setState('error'); setMessage(errorMessage(error)); }
        setDetails(error instanceof AdminApiError ? errorDetails(error.errors) : []);
        return false;
      } finally {
        inFlight.current = null;
        if (mounted.current && succeeded && !conflict.current && draftFingerprint(latest.current) !== saved.current) timer.current = setTimeout(() => { void saveRef.current(); }, 1000);
      }
    })();
    inFlight.current = operation;
    return operation;
  }, [api, project.id]);

  useEffect(() => { saveRef.current = save; }, [save]);
  useEffect(() => {
    latest.current = document;
    if (timer.current) clearTimeout(timer.current);
    if (!conflict.current && draftFingerprint(document) !== saved.current) {
      if (!inFlight.current) setState('dirty');
      timer.current = setTimeout(() => { void saveRef.current(); }, 1000);
    } else if (!conflict.current && !inFlight.current) {
      setState('saved'); setMessage(''); setDetails([]);
    }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [document]);
  useEffect(() => {
    mounted.current = true;
    function warn(event: BeforeUnloadEvent) { if (draftFingerprint(latest.current) !== saved.current) { event.preventDefault(); event.returnValue = ''; } }
    function guardNavigation(event: MouseEvent) {
      if (draftFingerprint(latest.current) === saved.current || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Есть несохранённые изменения. Покинуть редактор?')) { event.preventDefault(); event.stopPropagation(); }
    }
    window.addEventListener('beforeunload', warn);
    window.addEventListener('click', guardNavigation, true);
    return () => { mounted.current = false; window.removeEventListener('beforeunload', warn); window.removeEventListener('click', guardNavigation, true); if (timer.current) clearTimeout(timer.current); };
  }, []);

  function downloadCopy() {
    const blob = new Blob([JSON.stringify({ ...latest.current, revision: serverRevision.current }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = window.document.createElement('a');
    anchor.href = url; anchor.download = `${latest.current.slug || 'project'}-draft-backup.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  async function reload() {
    if (!window.confirm('Загрузить версию с сервера? Несохранённые изменения в этом редакторе будут заменены. Сначала скачайте копию, если хотите их сохранить.')) return;
    try {
      const result = await api<Project>(`/projects/${encodeURIComponent(project.id)}`);
      const next = { slug: result.slug, draft: result.draft };
      saved.current = draftFingerprint(next); serverRevision.current = result.revision;
      conflict.current = false; latest.current = next; setRevision(result.revision);
      setDocument(next); setState('saved'); setMessage(''); setDetails([]);
    } catch (error) { setMessage(errorMessage(error)); }
  }
  function setServerRevision(value: number) { serverRevision.current = value; setRevision(value); }
  function reportConflict() { conflict.current = true; setState('conflict'); setMessage('Проект изменён в другом окне. Ваши изменения остаются в редакторе. Скачайте копию и загрузите актуальную версию.'); }
  return { document, setDocument, state, message, details, revision, dirty, save, reload, downloadCopy, setServerRevision, reportConflict, getRevision: () => serverRevision.current };
}
