import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthStorage, StoredUser } from '@/lib/storage/auth-storage';
import { AuthApi, AuthResponse } from '@/lib/api/auth';

interface AuthContextType {
  user: StoredUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Initialize auth state from storage
   */
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const storedToken = await AuthStorage.getToken();
      const storedUser = await AuthStorage.getUser();

      if (storedToken && storedUser) {
        // Verify token is still valid by fetching profile
        try {
          const profile = await AuthApi.getProfile(storedToken);
          setToken(storedToken);
          setUser(profile);
        } catch (error) {
          // Token is invalid, clear storage
          await AuthStorage.clear();
          setToken(null);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response: AuthResponse = await AuthApi.login({ email, password });
      
      await AuthStorage.setToken(response.access_token);
      await AuthStorage.setUser(response.user);
      
      setToken(response.access_token);
      setUser(response.user);
    } catch (error) {
      const apiError = error as { message?: string };
      throw new Error(apiError.message || 'Login failed. Please try again.');
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    phone?: string
  ): Promise<void> => {
    try {
      const response: AuthResponse = await AuthApi.register({
        name,
        email,
        password,
        phone,
      });

      await AuthStorage.setToken(response.access_token);
      await AuthStorage.setUser(response.user);

      setToken(response.access_token);
      setUser(response.user);
    } catch (error) {
      const apiError = error as { message?: string };
      throw new Error(apiError.message || 'Registration failed. Please try again.');
    }
  };

  const logout = async (): Promise<void> => {
    console.log('AuthContext: logout called, token exists:', !!token);
    try {
      // Notify backend if we have a token
      if (token) {
        try {
          console.log('AuthContext: Notifying backend of logout...');
          await AuthApi.logout(token);
          console.log('AuthContext: Backend logout notification successful');
        } catch (error) {
          // Log but don't fail - we still want to clear local state
          console.warn('AuthContext: Backend logout notification failed:', error);
        }
      }

      // Clear local storage
      console.log('AuthContext: Clearing local storage...');
      await AuthStorage.clear();
      console.log('AuthContext: Local storage cleared');
      
      // Clear state
      console.log('AuthContext: Clearing state (token and user)...');
      setToken(null);
      setUser(null);
      console.log('AuthContext: State cleared, logout complete');
    } catch (error) {
      console.error('AuthContext: Failed to logout:', error);
      // Still clear local state even if storage fails
      setToken(null);
      setUser(null);
      console.log('AuthContext: State cleared despite error');
      // Re-throw so UI can handle it
      throw error;
    }
  };

  const refreshUser = async (): Promise<void> => {
    if (!token) return;

    try {
      const profile = await AuthApi.getProfile(token);
      await AuthStorage.setUser(profile);
      setUser(profile);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // If refresh fails, token might be invalid, logout
      await logout();
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

