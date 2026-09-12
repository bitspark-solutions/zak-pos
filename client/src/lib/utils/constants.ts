export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  DASHBOARD: '/dashboard',
  ADMIN_DASHBOARD: '/dashboard',
  POS: '/pos',
  PROFILE: '/profile',
  UNAUTHORIZED: '/unauthorized',
} as const;

export const ROLES = {
  ADMIN: 'admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  CASHIER: 'cashier',
} as const;
