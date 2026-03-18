'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/utils/constants';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

export function RoleGuard({ children, allowedRoles, redirectTo }: RoleGuardProps) {
  const { user, hasRole } = useAuth();
  const router = useRouter();

  if (!user) {
    router.push(ROUTES.LOGIN);
    return null;
  }

  const hasAllowedRole = allowedRoles.some(role => hasRole(role));

  if (!hasAllowedRole) {
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.push(ROUTES.UNAUTHORIZED);
    }
    return null;
  }

  return <>{children}</>;
}

