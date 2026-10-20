import type { Locale } from '@portfolio/contracts';
import styles from './Logic.module.css';

export function Logic({ locale }: { locale: Locale }) {
  const ru = locale === 'ru';
  return <section id="about" data-scene="logic" data-pin="120" className={styles.scene} aria-labelledby="logic-heading">
    <div className="sectionTop"><span><b>04</b> / &nbsp;{ru ? 'Мой подход' : 'My approach'}</span><span className="rule" /></div>
    <div className={styles.composition}>
      <div className={styles.medical} data-logic-part="0">
        <h2 id="logic-heading">{ru ? 'Логика.' : 'Logic.'}</h2>
        <div className={styles.caption}>
          <h3>{ru ? 'Медицинская подготовка' : 'Medical training'}</h3>
          <p>{ru ? 'Понимать человека и видеть систему.' : 'Understanding people. Seeing the system.'}</p>
        </div>
      </div>
      <span className={styles.times} data-logic-part="2" aria-label={ru ? 'в сочетании с' : 'combined with'}>
        <svg viewBox="0 0 76 76" aria-hidden="true"><path d="M2 2L74 74M74 2L2 74" /></svg>
      </span>
      <div className={styles.art} data-logic-part="1">
        <h2>{ru ? 'Чувство.' : 'Feeling.'}</h2>
        <div className={styles.caption}>
          <h3>{ru ? 'Художественная подготовка' : 'Artistic training'}</h3>
          <p>{ru ? 'Чувствовать композицию, цвет и форму.' : 'A sense of composition, colour and form.'}</p>
        </div>
      </div>
    </div>
    <div className={styles.connection} aria-hidden="true">
      <svg viewBox="0 0 1400 80" preserveAspectRatio="none"><path data-draw d="M0 8C300 8 320 72 700 72S1100 8 1400 8" /></svg>
    </div>
    <div className={styles.result} data-logic-result>
      <span>01 + 02</span>
      <p>{ru ? 'Продумано. Прочувствовано.' : 'Considered. Felt.'}</p>
    </div>
  </section>;
}
