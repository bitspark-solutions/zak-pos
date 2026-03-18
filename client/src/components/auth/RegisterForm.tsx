'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api/auth';
import { registerSchema, RegisterFormData } from '@/lib/validation/auth.schema';
import { InvitationTokenData } from '@/types/auth';
import { Input } from '@/components/forms/Input';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { Button } from '@/components/forms/Button';
import { FormError } from '@/components/forms/FormError';
import Link from 'next/link';
import styles from './RegisterForm.module.css';

export function RegisterForm() {
  const { register: registerUser, isLoading, error, clearError } = useAuth();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<InvitationTokenData | null>(null);
  const [validatingInvitation, setValidatingInvitation] = useState(false);

  const invitationToken = searchParams.get('token');

  // SECURITY: Validate invitation token on mount (if present)
  useEffect(() => {
    if (invitationToken) {
      validateInvitationToken(invitationToken);
    }
  }, [invitationToken]);

  const validateInvitationToken = async (token: string) => {
    try {
      setValidatingInvitation(true);
      setFormError(null);

      // SECURITY: Validate token via API (server-side validation)
      // The API and TypeScript types ensure role is NEVER 'owner'
      const data = await authApi.validateInvitationToken(token);

      // SECURITY: Store validated role and tenant (NOT from URL)
      setInvitationData({
        role: data.role,
        tenantId: data.tenantId,
      });
    } catch (err: unknown) {
      const error = err as { message?: string };
      setFormError(error.message || 'Invalid or expired invitation link. Please contact your administrator.');
    } finally {
      setValidatingInvitation(false);
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      businessName: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Watch form values for real-time feedback
  const password = watch('password');
  const confirmPassword = watch('confirmPassword');

  useEffect(() => {
    if (invitationData) {
      setValue('role', invitationData.role as 'manager' | 'cashier');
      setValue('tenantId', invitationData.tenantId);
    }
  }, [invitationData, setValue]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setFormError(null);
      clearError();

      // SECURITY: Use role and tenantId from validated invitation token (NOT from form data or URL)
      const registrationData = {
        ...data,
        role: invitationData?.role || data.role || undefined,
        tenantId: invitationData?.tenantId || data.tenantId || undefined,
      };

      // SECURITY: Final check - never allow owner role from invitation
      if (invitationData && registrationData.role === 'owner') {
        throw new Error('Invalid registration: Owner role cannot be assigned via invitation');
      }

      await registerUser(registrationData);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setFormError(error.message || 'Registration failed. Please try again.');
    }
  };

  if (validatingInvitation) {
    return (
      <div className={styles.loading}>
        <p>Validating invitation...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      {invitationData && (
        <div className={styles.invitationNotice}>
          <p>You&apos;ve been invited as a <strong>{invitationData.role}</strong></p>
        </div>
      )}

      {(error || formError) && (
        <FormError>{error || formError}</FormError>
      )}

      <Input
        {...register('name')}
        type="text"
        label="Full Name"
        placeholder="Enter your full name"
        required
        error={errors.name?.message}
        autoComplete="name"
      />

      <Input
        {...register('email')}
        type="email"
        label="Email"
        placeholder="Enter your email"
        required
        error={errors.email?.message}
        autoComplete="email"
        disabled={!!invitationData?.email} // Pre-filled if from invitation
      />

      <Input
        {...register('phone')}
        type="tel"
        label="Phone Number (Optional)"
        placeholder="+8801XXXXXXXXX"
        error={errors.phone?.message}
        autoComplete="tel"
      />

      {!invitationData && (
        <Input
          {...register('businessName')}
          type="text"
          label="Business Name (Optional)"
          placeholder="Enter your business name"
          error={errors.businessName?.message}
        />
      )}

      <Controller
        name="password"
        control={control}
        defaultValue=""
        render={({ field }) => (
          <PasswordInput
            {...field}
            label="Password"
            placeholder="Enter your password"
            required
            error={errors.password?.message}
            showStrengthIndicator
            showRequirements
            autoComplete="new-password"
          />
        )}
      />

      <Controller
        name="confirmPassword"
        control={control}
        defaultValue=""
        render={({ field }) => (
          <PasswordInput
            {...field}
            label="Confirm Password"
            placeholder="Confirm your password"
            required
            error={errors.confirmPassword?.message}
            autoComplete="new-password"
          />
        )}
      />
      
      {password && confirmPassword && (
        <div className={styles.passwordMatchIndicator}>
          {password === confirmPassword ? (
            <span className={styles.match}>✓ Passwords match</span>
          ) : (
            <span className={styles.mismatch}>✗ Passwords do not match</span>
          )}
        </div>
      )}

      {/* SECURITY: role and tenantId set via setValue on invitation validation */}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={isLoading}
        disabled={isLoading}
      >
        Create Account
      </Button>

      <div className={styles.links}>
        <Link href="/login" prefetch={false} className={styles.link}>
          Already have an account? Login
        </Link>
      </div>
    </form>
  );
}
