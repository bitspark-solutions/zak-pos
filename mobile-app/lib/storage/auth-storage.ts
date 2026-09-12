import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  tenantId: string;
  permissions?: string[];
}

const TOKEN_KEY = 'zakpos_mobile_token';
const USER_KEY = 'zakpos_mobile_user';

// In-memory fallback for web/testing
let memStorage: Record<string, string> = {};

export const AuthStorage = {
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : memStorage[TOKEN_KEY] || null;
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return memStorage[TOKEN_KEY] || null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      memStorage[TOKEN_KEY] = token;
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
        return;
      }
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch {
      memStorage[TOKEN_KEY] = token;
    }
  },

  async getUser(): Promise<StoredUser | null> {
    try {
      let raw: string | null = null;
      if (Platform.OS === 'web') {
        raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : memStorage[USER_KEY] || null;
      } else {
        raw = await SecureStore.getItemAsync(USER_KEY);
      }
      if (!raw && memStorage[USER_KEY]) {
        raw = memStorage[USER_KEY];
      }
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setUser(user: StoredUser): Promise<void> {
    try {
      const data = JSON.stringify(user);
      memStorage[USER_KEY] = data;
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem(USER_KEY, data);
        return;
      }
      await SecureStore.setItemAsync(USER_KEY, data);
    } catch {
      memStorage[USER_KEY] = JSON.stringify(user);
    }
  },

  async clear(): Promise<void> {
    memStorage = {};
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
        return;
      }
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch {
      // Ignored
    }
  },
};
