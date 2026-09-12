import axios from 'axios';
import { User, LoginData, RegisterData, AuthResponse, InvitationTokenData } from '@/types/auth';
import { tokenStorage } from '@/lib/auth/storage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  async login(data: LoginData): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/login', data);
    return res.data;
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/register', data);
    return res.data;
  },

  async getProfile(): Promise<User> {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
    return res.data;
  },

  async resetPassword(token: string, newPassword?: string): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>('/auth/reset-password', { token, newPassword });
    return res.data;
  },

  async validateInvitationToken(token: string): Promise<InvitationTokenData> {
    const res = await apiClient.get<InvitationTokenData>('/auth/invitation/' + token);
    return res.data;
  },

  async updateProfile(
    idOrData: string | { name: string; phone?: string },
    payload?: { name: string; phone?: string },
  ): Promise<User> {
    const body = typeof idOrData === 'string' ? payload : idOrData;
    const res = await apiClient.put<User>('/auth/profile', body);
    return res.data;
  },
};
