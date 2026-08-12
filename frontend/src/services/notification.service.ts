import api from './api';
import type { ApiResponse, Notification, NotificationType } from '@/types';

export interface NotificationFilters {
  page?: number;
  limit?: number;
  unread?: 'true' | 'false';
  type?: NotificationType;
}

const notificationService = {
  getAll: (params?: NotificationFilters) =>
    api.get<ApiResponse<{ notifications: Notification[]; unreadCount: number }>>(
      '/notifications',
      { params }
    ),

  getUnreadCount: () =>
    api.get<ApiResponse<{ unreadCount: number }>>('/notifications/unread-count'),

  markAsRead: (id: string) =>
    api.patch<ApiResponse<{ notification: Notification }>>(`/notifications/${id}/read`),

  markAllAsRead: () =>
    api.patch<ApiResponse<{ modified: number }>>('/notifications/read-all'),
};

export default notificationService;
