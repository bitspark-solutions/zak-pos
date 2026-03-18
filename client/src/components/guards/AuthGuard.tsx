'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/utils/constants';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { tokenStorage } from '@/lib/auth/storage';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Wait for auth initialization
      if (isLoading) return;

      // Check if token exists in storage (handles page refresh)
      const storedToken = tokenStorage.getToken();
      const storedUser = tokenStorage.getUserData();

      // If no token or user, redirect to login
      if (!storedToken || !storedUser || !isAuthenticated) {
        const currentPath = pathname;
        const redirectUrl = currentPath !== ROUTES.LOGIN
          ? `${ROUTES.LOGIN}?redirect=${encodeURIComponent(currentPath)}`
          : ROUTES.LOGIN;
        router.push(redirectUrl);
        return;
      }

      // Validate token by checking if user data is valid
      if (token && user) {
        setIsChecking(false);
      } else {
        // Token might be invalid, clear and redirect
        tokenStorage.clearAuthData();
        router.push(ROUTES.LOGIN);
      }
    };

    checkAuth();
  }, [isAuthenticated, isLoading, token, user, router, pathname]);

  // Show loading while checking authentication
  if (isLoading || isChecking) {
    return <LoadingSpinner fullPage text="Authenticating..." />;
  }

  // If not authenticated, don't render children (redirect is in progress)
  if (!isAuthenticated || !token || !user) {
    return null;
  }

  return <>{children}</>;
}

