'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordFormData } from '@/lib/validation/auth.schema';
import { authApi } from '@/lib/api/auth';
import { Input } from '@/components/forms/Input';
import { Button } from '@/components/forms/Button';
import { FormError } from '@/components/forms/FormError';
import Link from 'next/link';
import styles from './ForgotPasswordForm.module.css';

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(false);

      await authApi.forgotPassword(data.email);
      setSuccess(true);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.success}>
        <p className={styles.successMessage}>
          If an account exists with that email, you will receive a password reset link shortly.
        </p>
        <Link href="/login" className={styles.link}>
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      {error && <FormError>{error}</FormError>}

      <Input
        {...register('email')}
        type="email"
        label="Email"
        placeholder="Enter your email"
        required
        error={errors.email?.message}
        autoComplete="email"
      />

      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={isLoading}
        disabled={isLoading}
      >
        Send Reset Link
      </Button>

      <div className={styles.links}>
        <Link href="/login" className={styles.link}>
          Back to Login
        </Link>
      </div>
    </form>
  );
}

