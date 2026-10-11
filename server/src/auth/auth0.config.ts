export const auth0Config = {
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  audience: process.env.AUTH0_AUDIENCE || 'https://zakpos.com/api',
  issuerBaseURL: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}` : '',
  baseURL: process.env.AUTH0_BASE_URL || 'http://localhost:39847',
  secret: process.env.AUTH0_SECRET || 'zakpos-auth0-secret-key-change-in-production',
  connection: process.env.AUTH0_CONNECTION || 'Username-Password-Authentication',
  // Management API audience must end with a slash; request paths must not double one
  managementApiAudience: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}/api/v2/` : '',
  managementApiUrl: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}/api/v2` : '',
  // Machine-to-machine client with Auth0 Management API scopes (user CRUD)
  mgmtClientId: process.env.AUTH0_MGMT_CLIENT_ID || '',
  mgmtClientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET || '',
  routes: {
    login: '/auth/auth0/login',
    logout: '/auth/auth0/logout',
    callback: '/auth/auth0/callback',
    postLogoutRedirect: '/'
  }
};
