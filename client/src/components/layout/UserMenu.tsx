'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/constants';
import styles from './UserMenu.module.css';

interface UserMenuProps {
  user: {
    name?: string | null;
    email: string;
    role: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const getInitials = (name: string | undefined | null) => {
    // Defensive check: handle all falsy values and non-strings
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return 'U'; // Default to 'U' for User if name is not available
    }
    try {
      const initials = name
        .trim()
        .split(' ')
        .map(n => n[0])
        .filter(Boolean) // Filter out empty strings
        .join('')
        .toUpperCase()
        .slice(0, 2);
      return initials || 'U'; // Fallback to 'U' if no initials found
    } catch (error) {
      console.warn('Error generating initials:', error);
      return 'U';
    }
  };

  return (
    <div className={styles.menuContainer} ref={menuRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <div className={styles.avatar}>
          {getInitials(user?.name)}
        </div>
        <span className={styles.name}>{user.name || user.email}</span>
        <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user.name || user.email}</div>
            <div className={styles.userEmail}>{user.email}</div>
            <div className={styles.userRole}>Role: {user.role}</div>
          </div>
          <div className={styles.divider} />
          <Link href={ROUTES.PROFILE} className={styles.menuItem} onClick={() => setIsOpen(false)}>
            Profile
          </Link>
          <div className={styles.divider} />
          <button className={styles.menuItem} onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

