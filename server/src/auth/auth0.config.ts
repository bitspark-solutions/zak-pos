export const auth0Config = {
  domain: process.env.AUTH0_DOMAIN || 'your-tenant.auth0.com',
  clientId: process.env.AUTH0_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || 'your-client-secret',
  audience: process.env.AUTH0_AUDIENCE || 'your-api-identifier',
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN || 'your-tenant.auth0.com'}`,
  baseURL: process.env.AUTH0_BASE_URL || 'http://localhost:3000',
  secret: process.env.AUTH0_SECRET || 'your-long-random-secret',
  routes: {
    login: '/auth/login',
    logout: '/auth/logout',
    callback: '/auth/callback',
    postLogoutRedirect: '/'
  }
};
