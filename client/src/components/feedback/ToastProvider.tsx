'use client';

import { useState, useCallback, ReactNode } from 'react';
import { Toast, ToastType } from './Toast';
import styles from './ToastProvider.module.css';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // showToast will be implemented via context in future
  // const showToast = useCallback((message: string, type: ToastType) => {
  //   const id = Math.random().toString(36).substring(7);
  //   setToasts(prev => [...prev, { id, message, type }]);
  // }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <>
      {children}
      <div className={styles.container}>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </>
  );
}

// Export hook for using toast
export function useToast() {
  // This will be implemented with context in a real scenario
  // For now, we'll use a simple implementation
  const showToast = (message: string, type: ToastType = 'info') => {
    // This is a placeholder - in a real app, you'd use context
    console.log(`[Toast] ${type}: ${message}`);
  };
  return { showToast };
}

