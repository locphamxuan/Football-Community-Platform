import api from './api';
import type { ApiResponse, NotificationType, User } from '@/types';

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other';
  location?: { city?: string; district?: string };
  playerProfile?: {
    positions?: string[];
    skillLevel?: string;
    bio?: string;
  };
}

/** `mutedTypes` gửi lên là **toàn bộ** danh sách loại đang tắt, không phải phần thêm bớt. */
export interface NotificationPrefsPayload {
  push?: boolean;
  mutedTypes?: NotificationType[];
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

  updateNotificationPrefs: (data: NotificationPrefsPayload) =>
    api.patch<ApiResponse<{ user: User }>>('/users/me/notifications', data),

  changePassword: (data: ChangePasswordPayload) =>
    api.patch<ApiResponse<null>>('/users/me/password', data),
};

export default userService;
