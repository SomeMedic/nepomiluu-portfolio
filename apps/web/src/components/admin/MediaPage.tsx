'use client';
import { MediaLibrary } from './MediaPicker';
import styles from './admin.module.css';
export function MediaPage() { return <><div className={styles.pageHeading}><div><p className={styles.eyebrow}>Медиа</p><h1>Визуальный словарь.</h1><p className={styles.muted}>Все изображения портфолио в одном месте.</p></div></div><section className={styles.card}><MediaLibrary /></section></>; }
