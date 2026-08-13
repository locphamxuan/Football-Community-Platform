import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { Notification } from '@fcp/shared';
import { Button, EmptyState, ErrorState, Loading, Screen } from '../../src/components/ui';
import ChipRow from '../../src/components/ChipRow';
import RequireAuth from '../../src/components/RequireAuth';
import { notificationService } from '../../src/services/notification.service';
import { messageOf } from '../../src/lib/errors';
import { routeForLink } from '../../src/lib/notificationLinks';
import { NOTIFICATION_TYPE_LABELS, formatRelativeTime } from '../../src/lib/format';
import { colors, fontSize, radius, spacing } from '../../src/lib/theme';

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unread', label: 'Chưa đọc' },
];

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}) {
  const unread = notification.readAt === null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(notification)}
      style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && styles.rowPressed]}
    >
      <View style={styles.rowBody}>
        <Text style={[styles.title, unread && styles.titleUnread]}>{notification.title}</Text>
        {!!notification.body && <Text style={styles.body}>{notification.body}</Text>}
        <Text style={styles.meta}>
          {NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type} ·{' '}
          {formatRelativeTime(notification.createdAt)}
        </Text>
      </View>
      {unread && <View style={styles.dot} accessibilityLabel="Chưa đọc" />}
    </Pressable>
  );
}

function NotificationList() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () =>
      notificationService.list({
        limit: 50,
        ...(filter === 'unread' ? { unread: 'true' as const } : {}),
      }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: invalidate,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Mở thông báo là vừa đánh dấu đã đọc vừa đi tới nơi cần tới — tách ra chỉ khiến
  // hộp thư đầy thông báo chưa đọc mà người dùng đã xem rồi.
  const open = (notification: Notification) => {
    if (notification.readAt === null) markRead.mutate(notification._id);
    const target = routeForLink(notification.link);
    if (target) router.push(target as never);
  };

  if (isLoading) return <Loading label="Đang tải thông báo" />;
  if (error) return <ErrorState message={messageOf(error)} onRetry={refetch} />;

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <ChipRow label="" options={FILTERS} value={filter} onChange={setFilter} />
        {unreadCount > 0 && (
          <Button
            title={`Đánh dấu đã đọc hết (${unreadCount})`}
            variant="outline"
            onPress={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
          />
        )}
      </View>

      {notifications.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo nào'}
          hint="Lịch đặt được xác nhận, lời mời thi đấu và hoá đơn mới sẽ hiện ở đây."
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(notification) => notification._id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => <NotificationRow notification={item} onOpen={open} />}
        />
      )}
    </View>
  );
}

export default function NotificationsScreen() {
  return (
    <Screen>
      <RequireAuth message="Đăng nhập để nhận thông báo về lịch đặt và lời mời thi đấu.">
        <NotificationList />
      </RequireAuth>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  row: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.lg,
  },
  rowUnread: { backgroundColor: colors.primarySoft },
  rowPressed: { opacity: 0.7 },
  rowBody: { flex: 1 },
  title: { color: colors.text, fontSize: fontSize.md },
  titleUnread: { fontWeight: '700' },
  body: { color: colors.textMuted, marginTop: spacing.xs },
  meta: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: spacing.sm },
  dot: { backgroundColor: colors.primary, borderRadius: 4, height: 8, marginTop: 6, width: 8 },
});
