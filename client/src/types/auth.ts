export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'owner' | 'manager' | 'cashier';
  tenantId: string;
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  businessName?: string;
  role?: string; // Only from validated invitation token
  tenantId?: string; // Only from validated invitation token
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface InvitationTokenData {
  role: 'manager' | 'cashier'; // NEVER 'owner'
  tenantId: string;
  email?: string;
  expiresAt?: string;
}

