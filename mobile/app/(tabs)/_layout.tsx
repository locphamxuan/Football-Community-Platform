import { Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/lib/auth';
import { notificationService } from '../../src/services/notification.service';
import { colors, fontSize, radius } from '../../src/lib/theme';

/** Chuông hỏi lại mỗi phút, giống web — đủ nhanh mà không đánh thức máy liên tục. */
const UNREAD_POLL_MS = 60_000;

/**
 * Nhãn tab bằng chữ chứ không phải icon: dự án chưa có bộ icon nào, và thêm một
 * thư viện icon chỉ để vẽ năm cái hình là cái giá không đáng.
 */
function TabLabel({ label, badge }: { label: string; badge?: number }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {!!badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationService.unreadCount(),
    // Chưa đăng nhập thì không có hộp thư nào để đếm.
    enabled: !!user,
    refetchInterval: UNREAD_POLL_MS,
  });

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="fields"
        options={{ title: 'Tìm sân', tabBarLabel: () => <TabLabel label="Tìm sân" /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: 'Lịch của tôi', tabBarLabel: () => <TabLabel label="Lịch đặt" /> }}
      />
      <Tabs.Screen
        name="teams"
        options={{ title: 'Đội bóng', tabBarLabel: () => <TabLabel label="Đội bóng" /> }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Thông báo',
          tabBarLabel: () => <TabLabel label="Thông báo" badge={data?.unreadCount} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Hồ sơ', tabBarLabel: () => <TabLabel label="Hồ sơ" /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  labelRow: { alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'center' },
  label: { color: colors.textMuted, fontSize: fontSize.xs },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
});
