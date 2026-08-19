import api from './api';
import type { ApiResponse, User } from '@/types';

export interface RegisterPayload {
  email: string;
  password: string;
  username: string;
  fullName: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
}

const authService = {
  register: (data: RegisterPayload) =>
    api.post<ApiResponse<{ message: string }>>('/auth/register', data),

  login: (data: LoginPayload) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  // Không nhận token nào trong body — backend đặt lại cả hai cookie httpOnly.
  refreshToken: () => api.post<ApiResponse<null>>('/auth/refresh-token'),

  verifyEmail: (token: string) =>
    api.get(`/auth/verify-email/${token}`),

  resendVerification: (email: string) =>
    api.post('/auth/resend-verification', { email }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
};

export default authService;
