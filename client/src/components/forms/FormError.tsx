'use client';

import { ReactNode } from 'react';
import styles from './FormError.module.css';

interface FormErrorProps {
  children: ReactNode;
  className?: string;
}

export function FormError({ children, className }: FormErrorProps) {
  return (
    <div className={`${styles.formError} ${className || ''}`} role="alert">
      <span className={styles.icon}>⚠️</span>
      <span className={styles.message}>{children}</span>
    </div>
  );
}

