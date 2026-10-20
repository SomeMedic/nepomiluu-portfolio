'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SessionInfo } from '@portfolio/contracts';
import { AdminApiError, errorMessage, requestAdmin } from './api';
import styles from './admin.module.css';

interface AdminContextValue {
  session: SessionInfo;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
}
const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const context = useContext(AdminContext);
  if (!context) throw new Error('Admin context is unavailable');
  return context;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reauthenticate, setReauthenticate] = useState(false);
  const pathname = usePathname();

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setSession(await requestAdmin<SessionInfo>('/session')); }
    catch (error) { if (!(error instanceof AdminApiError && error.status === 401)) setError(errorMessage(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadSession(); }, [loadSession]);

  const api = useCallback(async <T,>(path: string, options?: RequestInit): Promise<T> => {
    try { return await requestAdmin<T>(path, options, session?.csrfToken); }
    catch (error) {
      if (error instanceof AdminApiError && (error.status === 401 || error.status === 403 && error.message === 'Invalid CSRF token')) { setError('Сеанс истёк. Войдите ещё раз, чтобы продолжить. Открытый черновик остаётся в редакторе.'); setReauthenticate(true); }
      throw error;
    }
  }, [session?.csrfToken]);

  async function logout() {
    if (!window.confirm('Выйти из студии? Убедитесь, что изменения сохранены.')) return;
    try { await api('/logout', { method: 'POST' }); setSession(null); }
    catch (error) { setError(errorMessage(error)); }
  }

  if (loading) return <main className={styles.admin}><div className={styles.loading} role="status">Открываем студию…</div></main>;
  if (!session) return <main className={styles.admin}><Login onLogin={setSession} connectionError={error} onRetry={loadSession} /></main>;

  return <AdminContext.Provider value={{ session, api }}><div className={styles.admin}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/admin"><span className={styles.brandMark}>ун.</span><span>Студия портфолио<small>Ульяна Непомилуева</small></span></Link>
      <nav aria-label="Разделы студии" className={styles.nav}>
        <Link href="/admin" aria-current={pathname === '/admin' || pathname.startsWith('/admin/projects') ? 'page' : undefined}>Проекты</Link>
        <Link href="/admin/home" aria-current={pathname === '/admin/home' ? 'page' : undefined}>Главная</Link>
        <Link href="/admin/media" aria-current={pathname === '/admin/media' ? 'page' : undefined}>Медиа</Link>
        <a href="/ru" target="_blank" rel="noreferrer">На сайт ↗</a>
      </nav>
      <div className={styles.account}><span>{session.email}</span><button onClick={logout} className={styles.quiet}>Выйти</button></div>
    </header>
    {error && <div className={styles.sessionError} role="alert">{error}<button className={styles.quiet} onClick={() => setError('')}>Закрыть</button></div>}
    <main className={styles.main}>{children}</main>
    <footer className={styles.adminFooter}>Небольшая студия больших историй.<span>Изменения становятся видны на сайте после публикации.</span></footer>
    {reauthenticate && <Reauthenticate onLogin={value => { setSession(value); setReauthenticate(false); setError(''); }} />}
  </div></AdminContext.Provider>;
}

function Reauthenticate({ onLogin }: { onLogin: (value: SessionInfo) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={styles.reauthenticate} aria-label="Повторный вход в студию" onCancel={event => event.preventDefault()}><p className={styles.error} role="alert">Сеанс истёк. Войдите ещё раз. Изменения остаются в открытом редакторе.</p><Login onLogin={onLogin} connectionError="" onRetry={() => {}} /></dialog>;
}

function Login({ onLogin, connectionError, onRetry }: { onLogin: (session: SessionInfo) => void; connectionError: string; onRetry: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError('');
    try {
      await requestAdmin('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      const session = await requestAdmin<SessionInfo>('/session');
      setPassword(''); onLogin(session);
    } catch (error) { setError(errorMessage(error)); }
    finally { setPending(false); }
  }
  return <div className={styles.loginWrap}><div className={styles.loginIntro}><a href="/ru" className={styles.brandMark}>ун.</a><p className={styles.eyebrow}>Личное пространство</p><h1>У каждой работы<br />есть своя история.</h1><p>Здесь истории обретают форму.</p></div>
    <form onSubmit={submit} className={styles.loginCard}><p className={styles.eyebrow}>Студия портфолио</p><h2>Рада видеть тебя.</h2><p className={styles.muted}>Войди, чтобы продолжить работу над проектами.</p>
      <label className={styles.field}>Электронная почта<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /></label>
      <label className={styles.field}>Пароль<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={500} /></label>
      {(error || connectionError) && <div role="alert" className={styles.error}>{error || connectionError}{connectionError && <button type="button" onClick={onRetry} className={styles.quiet}>Проверить соединение</button>}</div>}
      <button type="submit" className={styles.primary} disabled={pending}>{pending ? 'Входим…' : 'Войти в студию →'}</button>
      <small className={styles.muted}>Доступ только для владельца портфолио.</small>
    </form></div>;
}
