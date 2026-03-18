'use client';

import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
  text?: string;
}

export function LoadingSpinner({ size = 'md', fullPage = false, text }: LoadingSpinnerProps) {
  const spinner = (
    <div className={styles.spinnerContainer}>
      <div className={`${styles.spinner} ${styles[size]}`}>
        <div className={styles.circle}></div>
      </div>
      {text && <p className={styles.text}>{text}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className={styles.fullPage}>
        {spinner}
      </div>
    );
  }

  return spinner;
}

