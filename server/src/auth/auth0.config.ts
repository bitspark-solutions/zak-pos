export const auth0Config = {
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  audience: process.env.AUTH0_AUDIENCE || 'https://zakpos.com/api',
  issuerBaseURL: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}` : '',
  baseURL: process.env.AUTH0_BASE_URL || 'http://localhost:3000',
  secret: process.env.AUTH0_SECRET || 'zakpos-auth0-secret-key-change-in-production',
  routes: {
    login: '/auth/auth0/login',
    logout: '/auth/auth0/logout',
    callback: '/auth/auth0/callback',
    postLogoutRedirect: '/'
  }
};
