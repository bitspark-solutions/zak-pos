'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, ResetPasswordFormData } from '@/lib/validation/auth.schema';
import { authApi } from '@/lib/api/auth';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { Button } from '@/components/forms/Button';
import { FormError } from '@/components/forms/FormError';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/constants';
import styles from './ResetPasswordForm.module.css';

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setError('Invalid reset link. Please request a new password reset.');
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token || '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError('Invalid reset token');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await authApi.resetPassword(token, data.newPassword);

      // Redirect to login with success message
      router.push(`${ROUTES.LOGIN}?reset=success`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className={styles.error}>
        <FormError>Invalid or missing reset token</FormError>
        <Link href="/forgot-password" className={styles.link}>
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <input type="hidden" {...register('token')} value={token} />

      {error && <FormError>{error}</FormError>}

      <PasswordInput
        {...register('newPassword')}
        label="New Password"
        placeholder="Enter your new password"
        required
        error={errors.newPassword?.message}
        showStrengthIndicator
        showRequirements
        autoComplete="new-password"
      />

      <PasswordInput
        {...register('confirmPassword')}
        label="Confirm New Password"
        placeholder="Confirm your new password"
        required
        error={errors.confirmPassword?.message}
        autoComplete="new-password"
      />

      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={isLoading}
        disabled={isLoading}
      >
        Reset Password
      </Button>

      <div className={styles.links}>
        <Link href={ROUTES.LOGIN} className={styles.link}>
          Back to Login
        </Link>
      </div>
    </form>
  );
}

