'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext, AuthContextType } from './AuthContext';
import { User, LoginData, RegisterData } from '@/types/auth';
import { authApi } from '@/lib/api/auth';
import { tokenStorage } from '@/lib/auth/storage';
import { hasPermission, hasRole } from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/utils/constants';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      const storedToken = tokenStorage.getToken();
      const storedUser = tokenStorage.getUserData();

      if (storedToken && storedUser) {
        // Validate token by fetching profile
        try {
          const profile = await authApi.getProfile();
          setUser(profile as User);
          setToken(storedToken);
        } catch (err: unknown) {
          // Token invalid or expired, clear storage
          const error = err as { message?: string };
          console.warn('Token validation failed:', error.message || 'Unknown error');
          tokenStorage.clearAuthData();
          setUser(null);
          setToken(null);
        }
      } else {
        // No stored auth data
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
      tokenStorage.clearAuthData();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (data: LoginData) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.login({
        email: data.email,
        password: data.password,
      });

      // Store token and user data
      tokenStorage.setToken(response.access_token, data.rememberMe || false);
      tokenStorage.setUserData(response.user, data.rememberMe || false);

      setToken(response.access_token);
      setUser(response.user);

      // Redirect based on role
      if (response.user.role === 'owner' || response.user.role === 'manager') {
        router.push(ROUTES.DASHBOARD);
      } else if (response.user.role === 'cashier') {
        router.push(ROUTES.POS);
      } else {
        router.push(ROUTES.DASHBOARD);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      const errorMessage = error.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const register = useCallback(async (data: RegisterData) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.register(data);

      // Store token and user data
      tokenStorage.setToken(response.access_token, false);
      tokenStorage.setUserData(response.user, false);

      setToken(response.access_token);
      setUser(response.user);

      // Redirect based on role
      if (response.user.role === 'owner' || response.user.role === 'manager') {
        router.push(ROUTES.DASHBOARD);
      } else if (response.user.role === 'cashier') {
        router.push(ROUTES.POS);
      } else {
        router.push(ROUTES.DASHBOARD);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      const errorMessage = error.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const logout = useCallback(() => {
    tokenStorage.clearAuthData();
    setUser(null);
    setToken(null);
    setError(null);
    router.replace(ROUTES.LOGIN);
  }, [router]);

  const refreshToken = useCallback(async () => {
    // Future implementation for token refresh
    // For now, just validate current token
    try {
      const profile = await authApi.getProfile();
      setUser(profile as User);
    } catch {
      logout();
    }
  }, [logout]);

  const checkPermission = useCallback((permission: string): boolean => {
    return hasPermission(user, permission);
  }, [user]);

  const checkRole = useCallback((role: string): boolean => {
    return hasRole(user, role);
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshToken,
    hasPermission: checkPermission,
    hasRole: checkRole,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
