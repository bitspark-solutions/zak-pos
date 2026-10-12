import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { RoleGuard } from './RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/utils/constants';

jest.mock('@/hooks/useAuth');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('RoleGuard', () => {
  const mockPush = jest.fn();
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as unknown as ReturnType<typeof useRouter>);
  });

  it('redirects to login when user is not logged in', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      hasPermission: jest.fn(),
      hasRole: jest.fn(),
      clearError: jest.fn(),
    });

    render(
      <RoleGuard allowedRoles={['admin', 'manager']}>
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(mockPush).toHaveBeenCalledWith(ROUTES.LOGIN);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user has an allowed role', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Admin User',
        role: 'admin',
        tenantId: 't1',
        permissions: [],
      },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      hasPermission: jest.fn(),
      hasRole: (role: string) => role === 'admin',
      clearError: jest.fn(),
    });

    render(
      <RoleGuard allowedRoles={['admin', 'manager']}>
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to unauthorized when user lacks the required role', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '2',
        email: 'cashier@example.com',
        name: 'Cashier User',
        role: 'cashier',
        tenantId: 't1',
        permissions: [],
      },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      hasPermission: jest.fn(),
      hasRole: (role: string) => role === 'cashier',
      clearError: jest.fn(),
    });

    render(
      <RoleGuard allowedRoles={['admin', 'manager']}>
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(mockPush).toHaveBeenCalledWith(ROUTES.UNAUTHORIZED);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to custom redirectTo when specified and role check fails', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '2',
        email: 'cashier@example.com',
        name: 'Cashier User',
        role: 'cashier',
        tenantId: 't1',
        permissions: [],
      },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      hasPermission: jest.fn(),
      hasRole: (role: string) => role === 'cashier',
      clearError: jest.fn(),
    });

    render(
      <RoleGuard allowedRoles={['admin']} redirectTo="/custom-fallback">
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(mockPush).toHaveBeenCalledWith('/custom-fallback');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
