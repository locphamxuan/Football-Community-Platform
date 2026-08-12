import type { Notification, NotificationType } from '@fcp/shared';
import { authFetch } from '../lib/authFetch';
import { toQueryString } from './field.service';

export const notificationService = {
  list: (params: { limit?: number; unread?: 'true' | 'false'; type?: NotificationType } = {}) =>
    authFetch<{ notifications: Notification[]; unreadCount: number }>(
      `/notifications${toQueryString(params)}`
    ),

  unreadCount: () => authFetch<{ unreadCount: number }>('/notifications/unread-count'),

  markAsRead: (id: string) =>
    authFetch<{ notification: Notification }>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllAsRead: () =>
    authFetch<{ modified: number }>('/notifications/read-all', { method: 'PATCH' }),

  /** Đăng ký / gỡ thiết bị này khỏi danh sách nhận thông báo đẩy. */
  registerDevice: (token: string) =>
    authFetch<{ devices: number }>('/users/me/push-tokens', { method: 'POST', body: { token } }),

  unregisterDevice: (token: string) =>
    authFetch<{ devices: number }>('/users/me/push-tokens', { method: 'DELETE', body: { token } }),
};
