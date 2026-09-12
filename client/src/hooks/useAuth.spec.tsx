import React from 'react';
import { renderHook } from '@testing-library/react';
import { useAuth } from './useAuth';
import { AuthContext, AuthContextType } from '@/contexts/AuthContext';

describe('useAuth hook', () => {
  it('throws an error when used outside of AuthProvider', () => {
    // Suppress console.error for expected thrown error
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );

    spy.mockRestore();
  });

  it('returns auth context values when used inside AuthProvider', () => {
    const mockContextValue: AuthContextType = {
      user: {
        id: 'u-1',
        email: 'user@test.com',
        name: 'Test User',
        role: 'admin',
        tenantId: 't-1',
        permissions: ['all'],
      },
      token: 'jwt-token-123',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      hasPermission: jest.fn().mockReturnValue(true),
      hasRole: jest.fn().mockReturnValue(true),
      clearError: jest.fn(),
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={mockContextValue}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user?.name).toBe('Test User');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.hasRole('admin')).toBe(true);
  });
});
