'use client';

import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/guards/RoleGuard';
import styles from './page.module.css';

export default function POSPage() {
  const { user } = useAuth();

  return (
    <RoleGuard allowedRoles={['cashier', 'manager', 'owner']}>
      <div className={styles.container}>
        <h1 className={styles.title}>POS Interface</h1>
        <div className={styles.welcome}>
          <p>Welcome, {user?.name}!</p>
          <p className={styles.role}>Ready to process sales</p>
        </div>
        <div className={styles.content}>
          <p>POS interface coming soon...</p>
        </div>
      </div>
    </RoleGuard>
  );
}

