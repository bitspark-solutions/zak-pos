'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthProvider';
import { ToastProvider } from '@/components/feedback/ToastProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}

