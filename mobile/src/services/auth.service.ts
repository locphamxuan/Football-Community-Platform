import type { User } from '@fcp/shared';
import { apiFetch } from '../lib/api';
import { authFetch } from '../lib/authFetch';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  username: string;
  fullName: string;
  phone?: string;
}

export const authService = {
  login: (payload: LoginPayload) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: payload,
    }),

  register: (payload: RegisterPayload) =>
    apiFetch<{ message: string }>('/auth/register', { method: 'POST', body: payload }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),

  resendVerification: (email: string) =>
    apiFetch<{ message: string }>('/auth/resend-verification', { method: 'POST', body: { email } }),

  logout: () => authFetch<null>('/auth/logout', { method: 'POST' }),

  me: () => authFetch<{ user: User }>('/users/me'),
};
