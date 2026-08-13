import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Button, Card, DetailRow, Loading } from '../components/ui';
import RequireRole from '../components/RequireRole';
import { useAuth } from '../lib/auth';
import { MANAGEMENT_ROLES } from '../lib/roles';
import { ownerService } from '../services/owner.service';
import { messageOf } from '../lib/errors';
import { formatPrice } from '../lib/format';
import { colors, fontSize, spacing } from '../lib/theme';

function OwnerSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['owner-stats'],
    queryFn: () => ownerService.stats(),
  });
  const stats = data?.stats;

  // Chỉ cần con số chưa trả lời để gắn lên nút, nên xin đúng một bản ghi.
  const { data: reviews } = useQuery({
    queryKey: ['owner-reviews', 'unanswered-count'],
    queryFn: () => ownerService.reviews({ unanswered: true, limit: 1 }),
  });
  const unanswered = reviews?.unanswered ?? 0;

  return (
    <Card>
      <Text style={styles.sectionTitle}>Quản lý sân</Text>

      {isLoading ? (
        <Loading label="Đang tải số liệu sân" />
      ) : error ? (
        <Text style={styles.error}>{messageOf(error)}</Text>
      ) : stats ? (
        <View style={styles.stats}>
          <DetailRow label="Chờ xác nhận" value={String(stats.pendingBookings)} />
          <DetailRow label="Lịch hôm nay" value={String(stats.todayBookings)} />
          <DetailRow label="Doanh thu tháng này" value={formatPrice(stats.monthRevenue)} />
          <DetailRow
            label="Sân đang nhận đặt"
            value={`${stats.activeFields}/${stats.totalFields}`}
          />
        </View>
      ) : null}

      <View style={styles.action}>
        <Button title="Lịch đặt sân" onPress={() => router.push('/owner/bookings')} />
      </View>
      <View style={styles.action}>
        <Button title="Sân của tôi" variant="outline" onPress={() => router.push('/owner/fields')} />
      </View>
      <View style={styles.action}>
        <Button
          title={unanswered > 0 ? `Đánh giá (${unanswered} chờ trả lời)` : 'Đánh giá'}
          variant="outline"
          onPress={() => router.push('/owner/reviews')}
        />
      </View>
      <View style={styles.action}>
        <Button title="Gói thuê bao" variant="outline" onPress={() => router.push('/owner/billing')} />
      </View>
    </Card>
  );
}

function ManagerSection() {
  return (
    <Card>
      <Text style={styles.sectionTitle}>Quản lý đội bóng</Text>
      <Text style={styles.sectionHint}>
        Đội và lời mời thi đấu dùng chung màn hình với người chơi — bạn thấy thêm quyền
        của quản lý ở trong đó.
      </Text>
      <View style={styles.action}>
        <Button title="Đội của tôi" onPress={() => router.push('/(tabs)/teams')} />
      </View>
      <View style={styles.action}>
        <Button
          title="Lời mời thi đấu"
          variant="outline"
          onPress={() => router.push('/match-requests')}
        />
      </View>
      <View style={styles.action}>
        <Button
          title="Lịch sân của đội"
          variant="outline"
          onPress={() => router.push('/team/bookings')}
        />
      </View>
    </Card>
  );
}

function ManageHubBody() {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = user.roles.includes('admin');
  const canManageFields = user.roles.includes('field_owner') || isAdmin;
  const canManageTeams = user.roles.includes('team_manager') || isAdmin;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {canManageFields && <OwnerSection />}
      {canManageTeams && <ManagerSection />}

      <Text style={styles.footNote}>
        Quản trị nền tảng hiện vẫn chỉ có trên web, nơi có bảng biểu rộng.
      </Text>
    </ScrollView>
  );
}

export default function ManageHubScreen() {
  return (
    <RequireRole
      allow={MANAGEMENT_ROLES}
      authMessage="Đăng nhập bằng tài khoản chủ sân hoặc quản lý đội để vào khu quản lý."
      deniedTitle="Tài khoản chưa có quyền quản lý"
      deniedHint="Khu này dành cho chủ sân và quản lý đội. Liên hệ ban quản trị để được nâng quyền."
    >
      <ManageHubBody />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  sectionHint: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
  stats: { marginBottom: spacing.sm, marginTop: spacing.sm },
  action: { marginTop: spacing.md },
  error: { color: colors.danger, marginTop: spacing.sm },
  footNote: { color: colors.textSubtle, fontSize: fontSize.xs, textAlign: 'center' },
});
