'use client';

import { useEffect, useState } from 'react';
import type { User } from '@/types/auth';
import type { TenantProfile } from '@/types/admin';
import { adminApi } from '@/lib/api/admin';
import styles from './page.module.css';

interface StoreSettingsTabProps {
  user: User;
}

export function StoreSettingsTab({ user }: StoreSettingsTabProps) {
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    adminApi
      .getTenant()
      .then((t) => {
        if (!active) return;
        setTenant(t);
        setNameDraft(t.name);
      })
      .catch((e: Error) => {
        if (active) setError(e.message || 'Failed to load store settings');
      });
    return () => {
      active = false;
    };
  }, []);

  const canEdit = tenant !== null && nameDraft.trim() !== tenant.name;

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await adminApi.updateTenantName(nameDraft.trim());
      setTenant(updated);
      setNameDraft(updated.name);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message || 'Failed to update store name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Store Settings</h2>
      <p className={styles.cardSubtitle}>
        Workspace details for your store.
      </p>

      {error && <div className={styles.notice}>{error}</div>}
      {saved && !error && (
        <div className={styles.notice}>Store name updated.</div>
      )}

      {tenant ? (
        <div className={styles.info}>
          <div className={styles.infoRow}>
            <span className={styles.label}>Store Name</span>
            <span className={styles.value}>
              <input
                className={styles.input}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={!canEdit || saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Workspace (Tenant) ID</span>
            <span className={styles.value}>{tenant.id}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Plan</span>
            <span className={styles.value}>{tenant.plan}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Status</span>
            <span className={styles.value}>{tenant.status}</span>
          </div>
        </div>
      ) : (
        !error && <p className={styles.cardSubtitle}>Loading…</p>
      )}

      <div className={styles.info}>
        <div className={styles.infoRow}>
          <span className={styles.label}>Account Owner</span>
          <span className={styles.value}>{user.name}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Contact Email</span>
          <span className={styles.value}>{user.email}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Phone</span>
          <span className={styles.value}>{user.phone || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Your Role</span>
          <span className={styles.value}>{user.role}</span>
        </div>
      </div>
    </div>
  );
}
