import { Injectable } from '@nestjs/common';
import { auth0Config } from './auth0.config';

export interface Auth0UserInfo {
  sub: string;
  email: string;
  name?: string;
  nickname?: string;
  picture?: string;
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

export interface Auth0ManagementUser {
  user_id: string;
  email: string;
  name?: string;
  user_metadata?: {
    role?: string;
    tenantId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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
      returnTo: process.env.FRONTEND_URL || 'http://localhost:41923',
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
            // Without this Auth0 tries every connection and can fail with
            // "Password must be reset" or realm ambiguity
            connection: auth0Config.connection,
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
    if (!auth0Config.mgmtClientId || !auth0Config.mgmtClientSecret) {
      throw new Error(
        'Auth0 Management API client not configured (AUTH0_MGMT_CLIENT_ID / AUTH0_MGMT_CLIENT_SECRET)',
      );
    }
    try {
      const response = await fetch(
        `https://${auth0Config.domain}/oauth/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: auth0Config.mgmtClientId,
            client_secret: auth0Config.mgmtClientSecret,
            audience: auth0Config.managementApiAudience,
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

  private async managementRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const token = await this.getManagementApiToken();
    const response = await fetch(`${auth0Config.managementApiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Auth0 Management API ${method} ${path} failed (${response.status}): ${text}`,
      );
    }

    if (response.status === 204) {
      return null;
    }
    return await response.json();
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

  async getUser(userId: string): Promise<Auth0ManagementUser | null> {
    const user = await this.managementRequest(
      'GET',
      `/users/${encodeURIComponent(userId)}`,
    );
    return (user as Auth0ManagementUser) ?? null;
  }

  async findUserByEmail(email: string): Promise<Auth0ManagementUser | null> {
    const users = await this.managementRequest(
      'GET',
      `/users-by-email?${new URLSearchParams({ email }).toString()}`,
    );
    const list = users as Auth0ManagementUser[];
    return list.length > 0 ? list[0] : null;
  }

  async updateUser(
    userId: string,
    userData: {
      email?: string;
      name?: string;
      password?: string;
      user_metadata?: Record<string, unknown>;
    },
  ): Promise<Auth0ManagementUser | null> {
    const body: Record<string, unknown> = {};
    if (userData.email !== undefined) body.email = userData.email;
    if (userData.name !== undefined) body.name = userData.name;
    if (userData.user_metadata !== undefined) {
      body.user_metadata = userData.user_metadata;
    }

    let updated: Auth0ManagementUser | null = null;
    if (Object.keys(body).length > 0) {
      updated = (await this.managementRequest(
        'PATCH',
        `/users/${encodeURIComponent(userId)}`,
        body,
      )) as Auth0ManagementUser;
    }

    if (userData.password) {
      // Password changes go through a separate endpoint
      await this.managementRequest(
        'POST',
        `/users/${encodeURIComponent(userId)}/password-change`,
        { password: userData.password },
      );
    }

    return updated;
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      await this.managementRequest(
        'DELETE',
        `/users/${encodeURIComponent(userId)}`,
      );
      return true;
    } catch (error: unknown) {
      // 404 means already gone - treat as success
      const message = error instanceof Error ? error.message : '';
      if (message.includes('(404)')) {
        return true;
      }
      throw error;
    }
  }

  async getUsersByTenant(tenantId: string): Promise<Auth0ManagementUser[]> {
    const users = await this.managementRequest(
      'GET',
      `/users?${new URLSearchParams({
        q: `user_metadata.tenantId:"${tenantId}"`,
        search_engine: 'v3',
        per_page: '100',
      }).toString()}`,
    );
    return users as Auth0ManagementUser[];
  }
}
