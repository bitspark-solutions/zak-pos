'use client';

import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/guards/RoleGuard';
import styles from './page.module.css';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <RoleGuard allowedRoles={['owner', 'manager']}>
      <div className={styles.container}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.welcome}>
          <p>Welcome, {user?.name}!</p>
          <p className={styles.role}>Role: {user?.role}</p>
        </div>
        <div className={styles.cards}>
          <div className={styles.card}>
            <h3>Quick Stats</h3>
            <p>Dashboard content coming soon...</p>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}

