'use client';

import { useId } from 'react';
import type { Localized } from '@portfolio/contracts';
import styles from './admin.module.css';

export function LocalizedField({ label, value, onChange, multiline = false, hint, required = false }: { label: string; value: Localized; onChange: (value: Localized) => void; multiline?: boolean; hint?: string; required?: boolean }) {
  const id = useId();
  return <fieldset className={styles.localized}><legend>{label}{required && <span className={styles.required}> *</span>}</legend>{hint && <p className={styles.hint}>{hint}</p>}<div className={styles.localeGrid}>{(['ru', 'en'] as const).map(locale => <label key={locale} htmlFor={`${id}-${locale}`} className={styles.field}><span className={styles.language}>{locale === 'ru' ? 'Русский' : 'English'}<span>{locale.toUpperCase()}</span></span>{multiline ? <textarea id={`${id}-${locale}`} value={value[locale]} onChange={event => onChange({ ...value, [locale]: event.target.value })} rows={4} maxLength={30000} /> : <input id={`${id}-${locale}`} value={value[locale]} onChange={event => onChange({ ...value, [locale]: event.target.value })} maxLength={30000} />}</label>)}</div></fieldset>;
}

export function ErrorPanel({ message, details = [] }: { message: string; details?: string[] }) {
  return <div className={styles.error} role="alert"><strong>{message}</strong>{details.length > 0 && <ul>{details.map((detail, index) => <li key={`${index}-${detail}`}>{detail}</li>)}</ul>}</div>;
}
