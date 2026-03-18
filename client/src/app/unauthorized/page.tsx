import { Metadata } from 'next';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/constants';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Unauthorized - ZakPOS',
  description: 'You do not have permission to access this page',
};

export default function UnauthorizedPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>403</h1>
        <h2 className={styles.heading}>Unauthorized Access</h2>
        <p className={styles.message}>
          You do not have permission to access this page.
        </p>
        <div className={styles.actions}>
          <Link href={ROUTES.DASHBOARD} className={styles.button}>
            Go to Dashboard
          </Link>
          <Link href={ROUTES.PROFILE} className={styles.link}>
            View Profile
          </Link>
        </div>
      </div>
    </div>
  );
}

