import { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Forgot Password - ZakPOS',
  description: 'Reset your ZakPOS account password',
};

export default function ForgotPasswordPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.logo}>ZakPOS</h1>
          <h2 className={styles.title}>Forgot Password</h2>
          <p className={styles.subtitle}>Enter your email to receive a password reset link</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

