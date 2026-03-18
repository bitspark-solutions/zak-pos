import { Injectable } from '@nestjs/common';
import { auth0Config } from './auth0.config';

export interface Auth0UserInfo {
  sub: string;
  email: string;
  name?: string;
  nickname?: string;
  user_metadata?: {
    role?: string;
    tenantId?: string;
  };
}

export interface Auth0ValidationResult {
  accessToken: string;
  idToken: string;
  userInfo: Auth0UserInfo;
}

interface Auth0TokenResponse {
  access_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
}

interface Auth0ErrorResponse {
  error: string;
  error_description?: string;
}

interface Auth0UserResponse {
  user_id: string;
  email: string;
  name: string;
  user_metadata?: {
    role?: string;
    tenantId?: string;
  };
}

@Injectable()
export class Auth0Service {
  constructor() {
    console.log('Auth0 Service initialized with domain:', auth0Config.domain);
  }

  getConfig() {
    return auth0Config;
  }

  getLoginUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: auth0Config.clientId,
      redirect_uri: `${auth0Config.baseURL}${auth0Config.routes.callback}`,
      scope: 'openid profile email',
      state: 'zakpos_auth_state',
    });

    return `https://${auth0Config.domain}/authorize?${params.toString()}`;
  }

  getLogoutUrl(): string {
    const params = new URLSearchParams({
      returnTo: `${auth0Config.baseURL}${auth0Config.routes.postLogoutRedirect}`,
      client_id: auth0Config.clientId,
    });

    return `https://${auth0Config.domain}/v2/logout?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<Auth0TokenResponse> {
    try {
      const response = await fetch(
        `https://${auth0Config.domain}/oauth/token`,
        {
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
        },
      );

      if (!response.ok) {
        throw new Error(`Auth0 token exchange failed: ${response.statusText}`);
      }

      const data = (await response.json()) as Auth0TokenResponse;
      return data;
    } catch (error: unknown) {
      console.error('Token exchange error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to exchange code for tokens: ${errorMessage}`);
    }
  }

  async getUserInfo(accessToken: string): Promise<Auth0UserInfo> {
    try {
      const response = await fetch(`https://${auth0Config.domain}/userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Auth0 userinfo request failed: ${response.statusText}`,
        );
      }

      const userInfo = (await response.json()) as Auth0UserInfo;
      return userInfo;
    } catch (error: unknown) {
      console.error('User info error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get user info: ${errorMessage}`);
    }
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Auth0ValidationResult | null> {
    try {
      // Use Resource Owner Password Grant to authenticate user
      const response = await fetch(
        `https://${auth0Config.domain}/oauth/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'password',
            username: email,
            password: password,
            client_id: auth0Config.clientId,
            client_secret: auth0Config.clientSecret,
            audience: auth0Config.audience,
            scope: 'openid profile email',
          }),
        },
      );

      if (!response.ok) {
        const error = (await response.json()) as Auth0ErrorResponse;
        // Invalid credentials
        if (response.status === 401 || response.status === 403) {
          return null;
        }
        throw new Error(
          `Auth0 authentication failed: ${JSON.stringify(error)}`,
        );
      }

      const tokenData = (await response.json()) as Auth0TokenResponse;

      // Get user info using the access token
      const userInfo = await this.getUserInfo(tokenData.access_token);

      return {
        accessToken: tokenData.access_token,
        idToken: tokenData.id_token || '',
        userInfo: userInfo,
      };
    } catch (error: unknown) {
      console.error('Auth0 validation error:', error);
      return null;
    }
  }

  async getManagementApiToken(): Promise<string> {
    try {
      const response = await fetch(
        `https://${auth0Config.domain}/oauth/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: auth0Config.clientId,
            client_secret: auth0Config.clientSecret,
            audience: auth0Config.managementApiUrl,
            grant_type: 'client_credentials',
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get management token: ${error}`);
      }

      const data = (await response.json()) as Auth0TokenResponse;
      return data.access_token;
    } catch (error: unknown) {
      console.error('Management API token error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get management API token: ${errorMessage}`);
    }
  }

  async createUser(userData: {
    email: string;
    password: string;
    name: string;
    role: string;
    tenantId: string;
  }): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    auth0Id: string;
  }> {
    try {
      const managementToken = await this.getManagementApiToken();

      const response = await fetch(`${auth0Config.managementApiUrl}/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          name: userData.name,
          connection: 'Username-Password-Authentication', // Default Auth0 database connection
          user_metadata: {
            role: userData.role,
            tenantId: userData.tenantId,
          },
          email_verified: false, // Set to true if you want to skip email verification
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as Auth0ErrorResponse;
        throw new Error(`Auth0 user creation failed: ${JSON.stringify(error)}`);
      }

      const auth0User = (await response.json()) as Auth0UserResponse;

      return {
        id: auth0User.user_id,
        email: auth0User.email,
        name: auth0User.name,
        role: auth0User.user_metadata?.role || userData.role,
        tenantId: auth0User.user_metadata?.tenantId || userData.tenantId,
        auth0Id: auth0User.user_id,
      };
    } catch (error: unknown) {
      console.error('Auth0 user creation error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create user in Auth0: ${errorMessage}`);
    }
  }

  async getUser(userId: string): Promise<null> {
    // Placeholder for Auth0 user retrieval
    console.log('Getting user from Auth0:', userId);
    return await Promise.resolve(null);
  }

  async updateUser(
    userId: string,
    userData: Record<string, unknown>,
  ): Promise<null> {
    // Placeholder for Auth0 user update
    console.log('Updating user in Auth0:', userId, userData);
    return await Promise.resolve(null);
  }

  async deleteUser(userId: string): Promise<boolean> {
    // Placeholder for Auth0 user deletion
    console.log('Deleting user from Auth0:', userId);
    return await Promise.resolve(true);
  }

  async getUsersByTenant(tenantId: string): Promise<unknown[]> {
    // Placeholder for Auth0 tenant user retrieval
    console.log('Getting users by tenant from Auth0:', tenantId);
    return await Promise.resolve([]);
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<boolean> {
    // Placeholder for Auth0 role assignment
    console.log('Assigning role to user in Auth0:', userId, roleId);
    return await Promise.resolve(true);
  }

  async createRole(roleData: {
    name: string;
    description: string;
    permissions: string[];
  }): Promise<null> {
    // Placeholder for Auth0 role creation
    console.log('Creating role in Auth0:', roleData);
    return await Promise.resolve(null);
  }

  async getRoles(): Promise<unknown[]> {
    // Placeholder for Auth0 role retrieval
    console.log('Getting roles from Auth0');
    return await Promise.resolve([]);
  }
}
