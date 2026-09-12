import { StoredUser } from '@/lib/storage/auth-storage';

export interface AuthResponse {
  access_token: string;
  user: StoredUser;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const AuthApi = {
  async login(credentials: { email: string; password: string }): Promise<AuthResponse> {
    const res = await fetch(API_BASE_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Login failed');
    }
    return await res.json();
  },

  async register(data: { name: string; email: string; password: string; phone?: string }): Promise<AuthResponse> {
    const res = await fetch(API_BASE_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Registration failed');
    }
    return await res.json();
  },

  async getProfile(token: string): Promise<StoredUser> {
    const res = await fetch(API_BASE_URL + '/auth/me', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) {
      throw new Error('Failed to fetch profile');
    }
    return await res.json();
  },

  async logout(token: string): Promise<void> {
    try {
      await fetch(API_BASE_URL + '/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
    } catch {
      // Ignored
    }
  },
};
