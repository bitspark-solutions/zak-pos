'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/forms/Button';
import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  children: ReactNode;
  onRetry?: () => void;
  variant?: 'inline' | 'banner';
}

export function ErrorMessage({ children, onRetry, variant = 'inline' }: ErrorMessageProps) {
  if (variant === 'banner') {
    return (
      <div className={styles.banner} role="alert">
        <div className={styles.bannerContent}>
          <span className={styles.icon}>⚠️</span>
          <span className={styles.message}>{children}</span>
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.inline} role="alert">
      <span className={styles.icon}>⚠️</span>
      <span className={styles.message}>{children}</span>
    </div>
  );
}

