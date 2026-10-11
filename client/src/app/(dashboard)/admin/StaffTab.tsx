'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { adminApi } from '@/lib/api/admin';
import {
  createStaffSchema,
  STAFF_ROLES,
  type CreateStaffFormData,
} from '@/lib/validation/admin.schema';
import type { AdminUser, StaffRole } from '@/types/admin';
import type { User } from '@/types/auth';
import { Input } from '@/components/forms/Input';
import { Button } from '@/components/forms/Button';
import { FormError } from '@/components/forms/FormError';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import styles from './page.module.css';

interface StaffTabProps {
  currentUser: User;
}

const roleLabel = (role: string) =>
  STAFF_ROLES.find((r) => r === role)
    ? role.toUpperCase()
    : role;

export function StaffTab({ currentUser }: StaffTabProps) {
  // Server truth: GET/PATCH /users additionally require user:read / user:update
  // permissions, which only owner and admin hold (managers have neither), so
  // role editing is limited to owner/admin.
  const canCreate = currentUser.role === 'owner' || currentUser.role === 'admin';
  const canUpdateRoles = currentUser.role === 'owner' || currentUser.role === 'admin';

  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStaffFormData>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: { role: 'cashier' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await adminApi.listUsers();
      setStaff(data);
    } catch (err: unknown) {
      setStaff([]);
      setListError(
        (err as { message?: string }).message || 'Failed to load staff',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (data: CreateStaffFormData) => {
    try {
      setSubmitting(true);
      setFormError(null);
      setSuccess(null);
      const payload = { ...data, phone: data.phone || undefined };
      const created = await adminApi.createStaff(payload);
      setSuccess(`${created.name} was added to your team.`);
      reset({ role: 'cashier' });
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setFormError((err as { message?: string }).message || 'Failed to create staff member');
    } finally {
      setSubmitting(false);
    }
  };

  const onRoleChange = async (id: string, role: StaffRole) => {
    try {
      setRoleSavingId(id);
      setRoleError(null);
      const updated = await adminApi.updateStaffRole(id, { role });
      setStaff((prev) =>
        prev.map((s) => (s.id === id ? { ...s, role: updated.role } : s)),
      );
    } catch (err: unknown) {
      setRoleError(
        (err as { message?: string }).message || 'Failed to update role',
      );
    } finally {
      setRoleSavingId(null);
    }
  };

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.cardTitle}>Staff</h2>
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowForm((v) => !v);
                setSuccess(null);
              }}
            >
              {showForm ? 'Cancel' : 'Invite Staff'}
            </Button>
          )}
        </div>

        {success && <div className={styles.successMessage}>{success}</div>}
        {roleError && <FormError>{roleError}</FormError>}
        {listError && <FormError>{listError}</FormError>}

        {loading ? (
          <LoadingSpinner text="Loading staff..." />
        ) : staff.length === 0 ? (
          <p className={styles.empty}>No staff members yet.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td className={styles.rowName}>
                      {member.name}
                      {member.id === currentUser.id ? ' (You)' : ''}
                    </td>
                    <td className={styles.rowEmail}>{member.email}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          member.status === 'active'
                            ? styles.badgeActive
                            : styles.badgeInactive
                        }`}
                      >
                        {member.status || 'active'}
                      </span>
                    </td>
                    <td className={styles.cellSelect}>
                      {canUpdateRoles && member.id !== currentUser.id ? (
                        <select
                          className={styles.select}
                          value={member.role}
                          disabled={roleSavingId === member.id}
                          onChange={(e) =>
                            onRoleChange(member.id, e.target.value as StaffRole)
                          }
                          aria-label={`Role for ${member.name}`}
                        >
                          {STAFF_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{roleLabel(member.role)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canCreate && showForm && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Invite Staff Member</h2>
          {formError && <FormError>{formError}</FormError>}
          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <Input
              {...register('name')}
              type="text"
              label="Full Name"
              placeholder="Staff name"
              required
              error={errors.name?.message}
            />
            <Input
              {...register('email')}
              type="email"
              label="Email"
              placeholder="staff@example.com"
              required
              error={errors.email?.message}
            />
            <Input
              {...register('phone')}
              type="tel"
              label="Phone"
              placeholder="Phone number (optional)"
              error={errors.phone?.message}
            />
            <div className={styles.selectWrapper}>
              <label className={styles.label}>Role*</label>
              <select className={styles.select} {...register('role')}>
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
              {errors.role?.message && (
                <span className={styles.readOnlyNote}>{errors.role.message}</span>
              )}
            </div>
            <Input
              {...register('password')}
              type="password"
              label="Temporary Password"
              placeholder="Minimum 8 characters"
              required
              error={errors.password?.message}
            />
            <div className={styles.actions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={submitting}
              >
                Create Staff
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
