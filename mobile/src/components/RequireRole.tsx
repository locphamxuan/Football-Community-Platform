import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Role } from '@fcp/shared';
import RequireAuth from './RequireAuth';
import { Button, Screen } from './ui';
import { useAuth } from '../lib/auth';
import { colors, fontSize, spacing } from '../lib/theme';

/**
 * Bọc màn hình chỉ dành cho một số vai trò.
 *
 * Backend vẫn kiểm quyền trên từng endpoint — cổng này chỉ để người dùng hiểu vì sao
 * mình không vào được, thay vì nhận một màn hình rỗng hoặc lỗi 403 trần.
 */
export default function RequireRole({
  allow,
  authMessage,
  deniedTitle,
  deniedHint,
  children,
}: {
  /** Có một trong các vai trò này là vào được. */
  allow: Role[];
  authMessage: string;
  deniedTitle: string;
  deniedHint: string;
  children: ReactNode;
}) {
  return (
    <RequireAuth message={authMessage}>
      <RoleGate allow={allow} title={deniedTitle} hint={deniedHint}>
        {children}
      </RoleGate>
    </RequireAuth>
  );
}

function RoleGate({
  allow,
  title,
  hint,
  children,
}: {
  allow: Role[];
  title: string;
  hint: string;
  children: ReactNode;
}) {
  const { user } = useAuth();

  if (user && !allow.some((role) => user.roles.includes(role))) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
          <View style={styles.action}>
            <Button title="Quay lại" variant="outline" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700', textAlign: 'center' },
  hint: {
    color: colors.textMuted,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  action: { alignSelf: 'stretch' },
});
