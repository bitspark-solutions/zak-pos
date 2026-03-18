'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/utils/constants';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';

export default function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        // Redirect based on role
        if (user.role === 'owner' || user.role === 'manager') {
          router.push(ROUTES.DASHBOARD);
        } else if (user.role === 'cashier') {
          router.push(ROUTES.POS);
        } else {
          router.push(ROUTES.DASHBOARD);
        }
      } else {
        router.push(ROUTES.LOGIN);
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  return <LoadingSpinner fullPage text="Loading ZakPOS..." />;
}
