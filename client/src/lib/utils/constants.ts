export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  DASHBOARD: '/dashboard',
  ADMIN_DASHBOARD: '/dashboard',
  ADMIN: '/admin',
  POS: '/pos',
  IMPORT: '/import',
  PROFILE: '/profile',
  UNAUTHORIZED: '/unauthorized',
} as const;

export const ROLES = {
  ADMIN: 'admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  CASHIER: 'cashier',
} as const;

// Base URL of the NestJS API. Falls back to the locally running server port.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:39847/api/v1';

// Auth0 Universal Login entrypoint served by the API (server 302s to Auth0 ULP,
// callback then 302s back to the client root with ?token=<jwt>).
export const AUTH0_LOGIN_URL = `${API_BASE_URL}/auth/auth0/login`;

// Keys under which the Auth0 callback surfaces state on the landing page.
export const AUTH0_QUERY_PARAMS = {
  TOKEN: 'token',
  ERROR: 'error',
} as const;

// Browser storage keys. These match src/lib/auth/storage.ts so the shared
// ApiClient and the token storage stay in sync.
export const STORAGE_KEYS = {
  TOKEN: 'zakpos_auth_token',
  USER: 'zakpos_user_data',
  REMEMBER_ME: 'zakpos_remember_me',
} as const;
