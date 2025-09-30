import { Injectable } from '@nestjs/common';
import { auth0Config } from './auth0.config';

@Injectable()
export class Auth0Service {
  constructor() {
    console.log('Auth0 Service initialized with domain:', auth0Config.domain);
  }

  getLoginUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: auth0Config.clientId,
      redirect_uri: `${auth0Config.baseURL}${auth0Config.routes.callback}`,
      scope: 'openid profile email',
      state: 'zakpos_auth_state'
    });

    return `https://${auth0Config.domain}/authorize?${params.toString()}`;
  }

  getLogoutUrl(): string {
    const params = new URLSearchParams({
      returnTo: `${auth0Config.baseURL}${auth0Config.routes.postLogoutRedirect}`,
      client_id: auth0Config.clientId
    });

    return `https://${auth0Config.domain}/v2/logout?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<any> {
    try {
      const response = await fetch(`https://${auth0Config.domain}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: auth0Config.clientId,
          client_secret: auth0Config.clientSecret,
          code: code,
          redirect_uri: `${auth0Config.baseURL}${auth0Config.routes.callback}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Auth0 token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Token exchange error:', error);
      throw new Error(`Failed to exchange code for tokens: ${error.message}`);
    }
  }

  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await fetch(`https://${auth0Config.domain}/userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Auth0 userinfo request failed: ${response.statusText}`);
      }

      const userInfo = await response.json();
      return userInfo;
    } catch (error) {
      console.error('User info error:', error);
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    try {
      // For OAuth flow, we don't validate credentials directly
      // This is handled by the OAuth redirect flow
      console.log('Auth0 validation requested for:', email);
      return null;
    } catch (error) {
      console.log('Auth0 validation failed:', error.message);
      return null;
    }
  }

  async createUser(userData: {
    email: string;
    password: string;
    name: string;
    role: string;
    tenantId: string;
  }) {
    // For OAuth flow, user creation is handled by Auth0's signup flow
    console.log('Auth0 user creation requested for:', userData.email);
    return {
      id: Date.now().toString(),
      email: userData.email,
      name: userData.name,
      role: userData.role,
      tenantId: userData.tenantId
    };
  }

  async getUser(userId: string) {
    // Placeholder for Auth0 user retrieval
    console.log('Getting user from Auth0:', userId);
    return null;
  }

  async updateUser(userId: string, userData: any) {
    // Placeholder for Auth0 user update
    console.log('Updating user in Auth0:', userId, userData);
    return null;
  }

  async deleteUser(userId: string) {
    // Placeholder for Auth0 user deletion
    console.log('Deleting user from Auth0:', userId);
    return true;
  }

  async getUsersByTenant(tenantId: string) {
    // Placeholder for Auth0 tenant user retrieval
    console.log('Getting users by tenant from Auth0:', tenantId);
    return [];
  }

  async assignRoleToUser(userId: string, roleId: string) {
    // Placeholder for Auth0 role assignment
    console.log('Assigning role to user in Auth0:', userId, roleId);
    return true;
  }

  async createRole(roleData: {
    name: string;
    description: string;
    permissions: string[];
  }) {
    // Placeholder for Auth0 role creation
    console.log('Creating role in Auth0:', roleData);
    return null;
  }

  async getRoles() {
    // Placeholder for Auth0 role retrieval
    console.log('Getting roles from Auth0');
    return [];
  }
}
