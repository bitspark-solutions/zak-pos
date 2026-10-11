import { User } from '@/types/auth';

const TOKEN_KEY = 'zakpos_auth_token';
const USER_KEY = 'zakpos_user_data';

export const tokenStorage = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  },

  getUserData(): User | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // A "remember me" session keeps the token in localStorage rather than the
  // per-tab sessionStorage.
  isRemembered(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string, remember: boolean = false): void {
    if (typeof window === 'undefined') return;
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  setUserData(user: User, remember: boolean = false): void {
    if (typeof window === 'undefined') return;
    const data = JSON.stringify(user);
    if (remember) {
      localStorage.setItem(USER_KEY, data);
      sessionStorage.removeItem(USER_KEY);
    } else {
      sessionStorage.setItem(USER_KEY, data);
      localStorage.removeItem(USER_KEY);
    }
  },

  clearAuthData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },
};
