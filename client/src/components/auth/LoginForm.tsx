'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, LoginFormData } from '@/lib/validation/auth.schema';
import { Input } from '@/components/forms/Input';
import { Button } from '@/components/forms/Button';
import { FormError } from '@/components/forms/FormError';
import { AUTH0_LOGIN_URL } from '@/lib/utils/constants';
import Link from 'next/link';
import styles from './LoginForm.module.css';

export function LoginForm() {
  const { login, isLoading, error, clearError } = useAuth();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const handleAuth0Login = () => {
    // Server 302s to Auth0 Universal Login; the callback redirects back to the
    // client root with ?token=<jwt>, which AuthProvider consumes on landing.
    window.location.assign(AUTH0_LOGIN_URL);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setFormError(null);
      clearError();
      await login({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      });
    } catch (err: unknown) {
      const error = err as { message?: string };
      setFormError(error.message || 'Login failed. Please check your credentials.');
    }
  };

  // Show success message if redirected from password reset
  const resetSuccess = searchParams.get('reset');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      {resetSuccess === 'success' && (
        <div className={styles.successMessage}>
          Password reset successful! Please login with your new password.
        </div>
      )}
      {(error || formError) && (
        <FormError>{error || formError}</FormError>
      )}

      <Input
        {...register('email')}
        type="email"
        label="Email"
        placeholder="Enter your email"
        required
        error={errors.email?.message}
        autoComplete="email"
      />

      <Input
        {...register('password')}
        type="password"
        label="Password"
        placeholder="Enter your password"
        required
        error={errors.password?.message}
        autoComplete="current-password"
      />

      <div className={styles.rememberMe}>
        <input
          {...register('rememberMe')}
          type="checkbox"
          id="rememberMe"
          className={styles.checkbox}
        />
        <label htmlFor="rememberMe" className={styles.checkboxLabel}>
          Remember me
        </label>
      </div>

      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={isLoading}
        disabled={isLoading}
      >
        Login
      </Button>

      <div className={styles.divider}>
        <span className={styles.dividerText}>or</span>
      </div>

      <Button
        type="button"
        variant="secondary"
        fullWidth
        onClick={handleAuth0Login}
        disabled={isLoading}
      >
        Login with Auth0
      </Button>

      <div className={styles.links}>
        <Link href="/forgot-password" className={styles.link}>
          Forgot password?
        </Link>
        <span className={styles.separator}>•</span>
        <Link href="/register" className={styles.link}>
          Don&apos;t have an account? Register
        </Link>
      </div>
    </form>
  );
}

