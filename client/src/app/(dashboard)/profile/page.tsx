'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api/auth';
import { updateProfileSchema, UpdateProfileFormData } from '@/lib/validation/auth.schema';
import { Input } from '@/components/forms/Input';
import { Button } from '@/components/forms/Button';
import { FormError } from '@/components/forms/FormError';
import styles from './page.module.css';

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
    },
  });

  if (authLoading || !user) {
    return (
      <div className={styles.container}>
        <div>Loading...</div>
      </div>
    );
  }

  const onSubmit = async (data: UpdateProfileFormData) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      await authApi.updateProfile(user.id, data);
      setSuccess(true);
      setIsEditing(false);

      // Refresh user data
      window.location.reload();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
    setError(null);
    setSuccess(false);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Profile</h1>

      {success && (
        <div className={styles.successMessage}>
          Profile updated successfully!
        </div>
      )}

      {error && <FormError>{error}</FormError>}

      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.cardTitle}>Personal Information</h2>
          {!isEditing && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <Input
              {...register('name')}
              type="text"
              label="Name"
              required
              error={errors.name?.message}
            />

            <Input
              {...register('phone')}
              type="tel"
              label="Phone Number"
              error={errors.phone?.message}
            />

            <div className={styles.readOnly}>
              <label className={styles.label}>Email</label>
              <div className={styles.readOnlyValue}>{user.email}</div>
              <p className={styles.readOnlyNote}>Email cannot be changed</p>
            </div>

            <div className={styles.actions}>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSaving}
                disabled={isSaving}
              >
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className={styles.info}>
            <div className={styles.infoRow}>
              <span className={styles.label}>Name</span>
              <span className={styles.value}>{user.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Email</span>
              <span className={styles.value}>{user.email}</span>
            </div>
            {user.phone && (
              <div className={styles.infoRow}>
                <span className={styles.label}>Phone</span>
                <span className={styles.value}>{user.phone}</span>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={styles.label}>Role</span>
              <span className={styles.value}>{user.role}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Tenant ID</span>
              <span className={styles.value}>{user.tenantId}</span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Permissions</h2>
        <div className={styles.permissions}>
          {user.permissions && user.permissions.length > 0 ? (
            <ul className={styles.permissionsList}>
              {user.permissions.map((permission, index) => (
                <li key={index} className={styles.permission}>
                  {permission}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.noPermissions}>No permissions assigned</p>
          )}
        </div>
      </div>
    </div>
  );
}

