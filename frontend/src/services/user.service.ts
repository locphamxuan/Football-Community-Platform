import api from './api';
import type { ApiResponse, User } from '@/types';

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other';
  location?: { city?: string; district?: string };
  playerProfile?: {
    positions?: string[];
    skillLevel?: string;
    preferredFoot?: string;
    preferredFieldSize?: string[];
    bio?: string;
  };
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const userService = {
  getMe: () => api.get<ApiResponse<{ user: User }>>('/users/me'),

  updateProfile: (data: UpdateProfilePayload) =>
    api.patch<ApiResponse<{ user: User }>>('/users/me', data),

  changePassword: (data: ChangePasswordPayload) =>
    api.patch<ApiResponse<null>>('/users/me/password', data),
};

export default userService;
