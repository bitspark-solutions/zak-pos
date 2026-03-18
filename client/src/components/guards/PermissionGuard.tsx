'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/utils/constants';

interface PermissionGuardProps {
  children: React.ReactNode;
  permissions: string[];
  requireAll?: boolean; // If true, user must have ALL permissions; if false, user needs ANY permission
  redirectTo?: string;
}

export function PermissionGuard({
  children,
  permissions,
  requireAll = false,
  redirectTo
}: PermissionGuardProps) {
  const { user, hasPermission } = useAuth();
  const router = useRouter();

  if (!user) {
    router.push(ROUTES.LOGIN);
    return null;
  }

  const hasRequiredPermissions = requireAll
    ? permissions.every(permission => hasPermission(permission))
    : permissions.some(permission => hasPermission(permission));

  if (!hasRequiredPermissions) {
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.push(ROUTES.UNAUTHORIZED);
    }
    return null;
  }

  return <>{children}</>;
}

