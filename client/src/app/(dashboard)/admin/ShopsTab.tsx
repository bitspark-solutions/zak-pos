'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { adminApi } from '@/lib/api/admin';
import {
  createShopSchema,
  type CreateShopFormData,
} from '@/lib/validation/admin.schema';
import type { Shop } from '@/types/admin';
import { Input } from '@/components/forms/Input';
import { Button } from '@/components/forms/Button';
import { FormError } from '@/components/forms/FormError';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import styles from './page.module.css';

// Shops are provisioned automatically by the server during store registration,
// but there is no /shops HTTP endpoint yet (GET/PATCH/POST all 404). The list
// and create calls below are wired to the intended path so this section becomes
// live the moment the server exposes /shops; until then we show a notice.
export function ShopsTab() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateShopFormData>({
    resolver: zodResolver(createShopSchema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.listShops();
      setShops(data);
      setApiUnavailable(false);
    } catch {
      setShops([]);
      setApiUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (data: CreateShopFormData) => {
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      await adminApi.createShop({ name: data.name, address: data.address });
      setSuccess('Shop created.');
      reset();
      await load();
    } catch (err: unknown) {
      setApiUnavailable(true);
      setError((err as { message?: string }).message || 'Failed to create shop');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Shops</h2>
        <p className={styles.cardSubtitle}>Locations that sell through this POS.</p>

        {apiUnavailable && (
          <div className={styles.notice}>
            Shop management isn&apos;t available from the API yet — the server has
            no <code>/shops</code> endpoint. A default shop is created
            automatically when a store is registered.
          </div>
        )}

        {loading ? (
          <LoadingSpinner text="Loading shops..." />
        ) : shops.length === 0 ? (
          <p className={styles.empty}>No shops to display.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Time Zone</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => (
                  <tr key={shop.id}>
                    <td className={styles.rowName}>{shop.name}</td>
                    <td>{shop.address || '—'}</td>
                    <td>{shop.timeZone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Add Shop</h2>
        {success && <div className={styles.successMessage}>{success}</div>}
        {error && <FormError>{error}</FormError>}
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <Input
            {...register('name')}
            type="text"
            label="Shop Name"
            placeholder="e.g. Main Store"
            required
            error={errors.name?.message}
          />
          <Input
            {...register('address')}
            type="text"
            label="Address"
            placeholder="Shop address (optional)"
            error={errors.address?.message}
          />
          <div className={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={submitting}
            >
              Create Shop
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
