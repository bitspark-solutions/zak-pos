import { Injectable } from '@nestjs/common';
import { ManagementClient } from 'auth0';
import axios from 'axios';
import { auth0Config } from './auth0.config';

@Injectable()
export class Auth0Service {
  private managementClient: ManagementClient;
  private accessToken: string;

  constructor() {
    this.managementClient = new ManagementClient({
      domain: auth0Config.domain,
      clientId: auth0Config.clientId,
      clientSecret: auth0Config.clientSecret
    });
    
    console.log('Auth0 Service initialized with domain:', auth0Config.domain);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(`https://${auth0Config.domain}/oauth/token`, {
        client_id: auth0Config.clientId,
        client_secret: auth0Config.clientSecret,
        audience: `https://${auth0Config.domain}/api/v2/`,
        grant_type: 'client_credentials'
      });

      this.accessToken = response.data.access_token;
      return this.accessToken;
    } catch (error) {
      throw new Error(`Failed to get Auth0 access token: ${error.message}`);
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    try {
      // First, try to authenticate with Auth0
      const authResponse = await axios.post(`https://${auth0Config.domain}/oauth/token`, {
        client_id: auth0Config.clientId,
        client_secret: auth0Config.clientSecret,
        audience: auth0Config.audience,
        grant_type: 'password',
        username: email,
        password: password,
        scope: 'openid profile email'
      });

      if (!authResponse.data.access_token) {
        return null;
      }

      // Get user info from Auth0
      const userInfoResponse = await axios.get(`https://${auth0Config.domain}/userinfo`, {
        headers: {
          Authorization: `Bearer ${authResponse.data.access_token}`
        }
      });

      return {
        auth0Id: userInfoResponse.data.sub,
        email: userInfoResponse.data.email,
        name: userInfoResponse.data.name,
        accessToken: authResponse.data.access_token,
        idToken: authResponse.data.id_token
      };
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
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.post(`https://${auth0Config.domain}/api/v2/users`, {
        connection: 'Username-Password-Authentication',
        email: userData.email,
        password: userData.password,
        name: userData.name,
        user_metadata: {
          role: userData.role,
          tenantId: userData.tenantId
        },
        app_metadata: {
          role: userData.role,
          tenantId: userData.tenantId
        }
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create user in Auth0: ${error.message}`);
    }
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
