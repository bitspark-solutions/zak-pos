'use client';

import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from './UserMenu';
import styles from './Header.module.css';

export function Header() {
  const { user } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <h1>ZakPOS</h1>
        </div>
        <nav className={styles.nav}>
          {user && <UserMenu user={user} />}
        </nav>
      </div>
    </header>
  );
}

