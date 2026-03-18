import { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Reset Password - ZakPOS',
  description: 'Reset your ZakPOS account password',
};

export default function ResetPasswordPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.logo}>ZakPOS</h1>
          <h2 className={styles.title}>Reset Password</h2>
          <p className={styles.subtitle}>Enter your new password</p>
        </div>
        <Suspense fallback={<div>Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

