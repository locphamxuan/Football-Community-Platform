import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Button, Card, DetailRow, TextField } from '../components/ui';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../lib/auth';
import { userService } from '../services/user.service';
import { messageOf } from '../lib/errors';
import { SKILL_LEVEL_LABELS, formatDate } from '../domain/format';
import { colors, fontSize, spacing } from '../theme';

function ProfileBody() {
  const { user, logout, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => userService.updateProfile({ fullName: fullName.trim(), phone: phone.trim() }),
    onSuccess: async () => {
      await refreshUser();
      setEditing(false);
    },
    onError: (err) => setError(messageOf(err)),
  });

  if (!user) return null;
  const stats = user.playerProfile?.stats;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.name}>{user.fullName}</Text>
      <Text style={styles.email}>{user.email}</Text>

      {editing ? (
        <Card>
          <TextField label="Họ và tên" value={fullName} onChangeText={setFullName} />
          <TextField
            label="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button title="Lưu" onPress={() => save.mutate()} loading={save.isPending} />
          <View style={styles.action}>
            <Button
              title="Huỷ"
              variant="outline"
              onPress={() => {
                setEditing(false);
                setFullName(user.fullName);
                setPhone(user.phone);
                setError(null);
              }}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <DetailRow label="Tên đăng nhập" value={user.username} />
          <DetailRow label="Số điện thoại" value={user.phone || 'Chưa có'} />
          <DetailRow
            label="Trình độ"
            value={SKILL_LEVEL_LABELS[user.playerProfile?.skillLevel ?? ''] ?? 'Chưa đặt'}
          />
          <DetailRow label="Tham gia từ" value={formatDate(user.createdAt)} />
          <View style={styles.action}>
            <Button title="Sửa hồ sơ" variant="outline" onPress={() => setEditing(true)} />
          </View>
        </Card>
      )}

      <Card>
        <Text style={styles.sectionTitle}>Thành tích cá nhân</Text>
        <DetailRow label="Số trận" value={String(stats?.matchesPlayed ?? 0)} />
        <DetailRow
          label="Thắng / Hoà / Thua"
          value={`${stats?.wins ?? 0} / ${stats?.draws ?? 0} / ${stats?.losses ?? 0}`}
        />
        <DetailRow label="Elo" value={String(stats?.eloRating ?? 1200)} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Thông báo</Text>
        <Text style={styles.hint}>
          Chọn việc gì đáng để làm phiền bạn, theo từng loại thông báo.
        </Text>
        <View style={styles.action}>
          <Button
            title="Cài đặt thông báo"
            variant="outline"
            onPress={() => router.push('/notification-settings')}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Khác</Text>
        <View style={styles.action}>
          <Button
            title="Gói thuê bao chủ sân"
            variant="outline"
            onPress={() => router.push('/plans')}
          />
        </View>
        <Text style={styles.hint}>
          Chủ sân và quản lý đội có thêm tab &quot;Quản lý&quot;. Quản trị nền tảng vẫn chỉ có trên web.
        </Text>
      </Card>

      <Button
        title="Đăng xuất"
        variant="danger"
        onPress={() =>
          Alert.alert('Đăng xuất', 'Bạn chắc chắn muốn đăng xuất khỏi thiết bị này?', [
            { text: 'Ở lại', style: 'cancel' },
            {
              text: 'Đăng xuất',
              style: 'destructive',
              onPress: async () => {
                await logout();
                router.replace('/(tabs)/fields');
              },
            },
          ])
        }
      />
    </ScrollView>
  );
}

export default function ProfileScreen() {
  return (
    <RequireAuth message="Đăng nhập để xem hồ sơ và thành tích của bạn.">
      <ProfileBody />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  name: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  email: { color: colors.textMuted, marginBottom: spacing.lg, marginTop: spacing.xs },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.sm },
  action: { marginTop: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },
  hint: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: spacing.sm },
});
