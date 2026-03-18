'use client';

import { AuthGuard } from '@/components/guards/AuthGuard';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import styles from './layout.module.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className={styles.container}>
        <Header />
        <div className={styles.content}>
          <Sidebar />
          <main className={styles.main}>
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

