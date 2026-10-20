'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from '@/components/case/case.module.css';

export default function ProjectError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale: string }>();
  const locale = params.locale === 'en' ? 'en' : 'ru';
  return <main className={styles.error} lang={locale}><p className={styles.eyebrow}>{locale === 'ru' ? 'Кейс временно недоступен' : 'Case temporarily unavailable'}</p><h1>{locale === 'ru' ? 'Не удалось загрузить проект.' : 'We couldn’t load this project.'}</h1><p role="alert">{locale === 'ru' ? 'Попробуйте ещё раз или вернитесь на главную.' : 'Please try again or return to the home page.'}</p><div><button type="button" onClick={reset}>{locale === 'ru' ? 'Попробовать снова' : 'Try again'}</button><Link href={`/${locale}`}>{locale === 'ru' ? 'На главную' : 'Back to home'} →</Link></div></main>;
}
