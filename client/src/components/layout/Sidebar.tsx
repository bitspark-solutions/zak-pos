'use client';

import { useAuth } from '@/hooks/useAuth';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/constants';
import styles from './Sidebar.module.css';

interface MenuItem {
  label: string;
  href: string;
  icon?: string;
  roles: string[];
  permissions?: string[];
}

const menuItems: MenuItem[] = [
  {
    label: 'Admin Dashboard',
    href: ROUTES.ADMIN_DASHBOARD,
    icon: '🏠',
    roles: ['admin'],
  },
  {
    label: 'Dashboard',
    href: ROUTES.DASHBOARD,
    icon: '📊',
    roles: ['owner', 'manager'],
  },
  {
    label: 'POS',
    href: ROUTES.POS,
    icon: '🛒',
    roles: ['cashier', 'manager', 'owner'],
  },
  {
    label: 'Admin',
    href: ROUTES.ADMIN,
    icon: '🛠️',
    roles: ['owner', 'manager'],
    permissions: ['user:read'],
  },
  {
    label: 'Products',
    href: '/products',
    icon: '📦',
    roles: ['owner', 'manager'],
    permissions: ['product:read'],
  },
  {
    label: 'Import',
    href: ROUTES.IMPORT,
    icon: '📥',
    roles: ['owner', 'manager'],
    permissions: ['product:create'],
  },
  {
    label: 'Receipts',
    href: ROUTES.RECEIPTS,
    icon: '🧾',
    roles: ['owner', 'manager'],
    permissions: ['product:create'],
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: '📋',
    roles: ['owner', 'manager'],
    permissions: ['inventory:read'],
  },
  {
    label: 'Sales',
    href: '/sales',
    icon: '💰',
    roles: ['owner', 'manager', 'cashier'],
    permissions: ['sale:read'],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: '📈',
    roles: ['owner', 'manager'],
    permissions: ['report:read'],
  },
  {
    label: 'Users',
    href: '/users',
    icon: '👥',
    roles: ['owner'],
    permissions: ['user:read'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: '⚙️',
    roles: ['owner'],
    permissions: ['system:settings:update'],
  },
];

export function Sidebar() {
  const { user, hasPermission } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const filteredMenuItems = menuItems.filter(item => {
    // Check role
    if (!user.role || !item.roles.includes(user.role)) {
      return false;
    }

    // Check permissions if specified
    if (item.permissions && item.permissions.length > 0) {
      return item.permissions.some(permission => hasPermission(permission));
    }

    return true;
  });

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        <ul className={styles.menuList}>
          {filteredMenuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
                >
                  {item.icon && <span className={styles.icon}>{item.icon}</span>}
                  <span className={styles.label}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

