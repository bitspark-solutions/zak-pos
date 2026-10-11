'use client';

import { useState } from 'react';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { StoreSettingsTab } from './StoreSettingsTab';
import { ShopsTab } from './ShopsTab';
import { StaffTab } from './StaffTab';
import styles from './page.module.css';

type AdminTab = 'store' | 'shops' | 'staff';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'store', label: 'Store Settings' },
  { id: 'shops', label: 'Shops' },
  { id: 'staff', label: 'Staff' },
];

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('store');

  if (isLoading || !user) {
    return <LoadingSpinner fullPage text="Loading admin..." />;
  }

  return (
    <RoleGuard allowedRoles={['owner', 'manager', 'admin']}>
      <div className={styles.container}>
        <h1 className={styles.title}>Admin</h1>

        <div className={styles.tabs} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.tab} ${
                activeTab === tab.id ? styles.tabActive : ''
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'store' && <StoreSettingsTab user={user} />}
        {activeTab === 'shops' && <ShopsTab />}
        {activeTab === 'staff' && <StaffTab currentUser={user} />}
      </div>
    </RoleGuard>
  );
}
