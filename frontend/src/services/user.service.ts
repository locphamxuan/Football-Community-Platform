import api from './api';
import type { ApiResponse, ChatParticipantProfile, NotificationType, User } from '@/types';

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

  /**
   * Tìm người để bắt chuyện hoặc mời vào nhóm. Backend đã loại sẵn chính mình, tài khoản
   * bị khoá và quản trị viên nền tảng, nên kết quả trả về là danh sách nhắn được ngay.
   */
  search: (q: string) =>
    api.get<ApiResponse<{ users: ChatParticipantProfile[] }>>('/users/search', { params: { q } }),
};

export default userService;
