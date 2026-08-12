import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Loading, Screen } from './ui';
import { useAuth } from '../lib/auth';
import { colors, fontSize, spacing } from '../lib/theme';

/**
 * Bọc phần màn hình cần phiên đăng nhập.
 *
 * Mời đăng nhập ngay tại chỗ thay vì đá người dùng sang màn khác: họ đang muốn xem
 * lịch đặt của mình, chuyển màn đột ngột làm mất luôn ngữ cảnh đó.
 */
export default function RequireAuth({
  children,
  message,
}: {
  children: ReactNode;
  message: string;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.title}>Cần đăng nhập</Text>
          <Text style={styles.hint}>{message}</Text>
          <View style={styles.actions}>
            <Button title="Đăng nhập" onPress={() => router.push('/(auth)/login')} />
          </View>
          <View style={styles.actions}>
            <Button
              title="Tạo tài khoản"
              variant="outline"
              onPress={() => router.push('/(auth)/register')}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  hint: {
    color: colors.textMuted,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  actions: { alignSelf: 'stretch', marginBottom: spacing.md },
});
