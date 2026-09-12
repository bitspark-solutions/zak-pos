jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (key: string) => store[key] || null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
});

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { AuthStorage, StoredUser } from './auth-storage';

describe('AuthStorage', () => {
  beforeEach(async () => {
    await AuthStorage.clear();
  });

  it('should store and retrieve auth token', async () => {
    expect(await AuthStorage.getToken()).toBeNull();
    await AuthStorage.setToken('test-token-12345');
    expect(await AuthStorage.getToken()).toBe('test-token-12345');
  });

  it('should store and retrieve user profile', async () => {
    expect(await AuthStorage.getUser()).toBeNull();

    const mockUser: StoredUser = {
      id: 'usr-1',
      email: 'pos@zakpos.com',
      name: 'Cashier One',
      role: 'cashier',
      tenantId: 'tenant-pos-1',
    };

    await AuthStorage.setUser(mockUser);
    const retrieved = await AuthStorage.getUser();
    expect(retrieved).toEqual(mockUser);
  });

  it('should clear stored token and user on clear()', async () => {
    await AuthStorage.setToken('token-to-delete');
    await AuthStorage.setUser({
      id: 'usr-2',
      email: 'del@zakpos.com',
      name: 'Delete Me',
      role: 'manager',
      tenantId: 'tenant-1',
    });

    await AuthStorage.clear();
    expect(await AuthStorage.getToken()).toBeNull();
    expect(await AuthStorage.getUser()).toBeNull();
  });
});
