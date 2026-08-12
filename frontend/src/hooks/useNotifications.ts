import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import notificationService, { type NotificationFilters } from '@/services/notification.service';

export const NOTIFICATIONS_KEY = ['notifications'];

/**
 * Chuông hỏi lại mỗi phút.
 *
 * Polling chứ không WebSocket: một kết nối thường trực cho mỗi tab là cái giá
 * quá đắt so với việc biết sớm hơn vài chục giây. Khi nào có số liệu chứng minh
 * độ trễ này là vấn đề thì mới đổi.
 */
const POLL_INTERVAL_MS = 60_000;

export const useNotifications = (filters?: NotificationFilters) =>
  useQuery({
    queryKey: [...NOTIFICATIONS_KEY, filters ?? {}],
    queryFn: () => notificationService.getAll(filters),
    refetchInterval: POLL_INTERVAL_MS,
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
};
