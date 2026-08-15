import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { TeamBooking } from '@fcp/shared';
import { Badge, Card, EmptyState, ErrorState, Loading } from '../components/ui';
import RequireRole from '../components/RequireRole';
import { bookingService } from '../services/booking.service';
import { messageOf } from '../lib/errors';
import { BOOKING_STATUS_LABELS, formatPrice, formatSlot } from '../domain/format';
import { colors, fontSize, spacing, type StatusTone } from '../theme';

const STATUS_TONES: Record<string, StatusTone> = {
  pending: 'pending',
  confirmed: 'active',
  completed: 'done',
  cancelled: 'failed',
  no_show: 'failed',
};

function TeamBookingList() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['team-bookings'],
    queryFn: () => bookingService.teamBookings({ limit: 50 }),
  });

  const bookings = data?.bookings ?? [];

  if (isLoading) return <Loading label="Đang tải lịch sân của đội" />;
  if (error) return <ErrorState message={messageOf(error)} onRetry={refetch} />;

  if (bookings.length === 0) {
    return (
      <EmptyState
        title="Đội chưa có lịch sân nào"
        hint="Lịch xuất hiện ở đây khi thành viên đặt sân và chọn tên đội lúc đặt."
      />
    );
  }

  return (
    <FlatList
      data={bookings}
      keyExtractor={(booking) => booking._id}
      contentContainerStyle={styles.list}
      onRefresh={refetch}
      refreshing={isRefetching}
      renderItem={({ item }) => <TeamBookingCard booking={item} />}
    />
  );
}

function TeamBookingCard({ booking }: { booking: TeamBooking }) {
  return (
    <Card>
      <View style={styles.cardHead}>
        <Text style={styles.team}>{booking.team?.name ?? 'Đội đã giải thể'}</Text>
        <Badge
          label={BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
          tone={STATUS_TONES[booking.status] ?? 'neutral'}
        />
      </View>

      <Text style={styles.place}>{booking.field?.name ?? 'Sân đã gỡ'}</Text>
      <Text style={styles.slot}>{formatSlot(booking.date, booking.startTime, booking.endTime)}</Text>
      {/* Sân con là sub-document nhúng trong Field và endpoint này không giải tên ra,
          nên hiện người đặt — thứ quản lý đội cần biết hơn số hiệu sân con. */}
      <Text style={styles.slot}>Người đặt: {booking.user?.fullName ?? 'Đã xoá tài khoản'}</Text>
      <Text style={styles.price}>{formatPrice(booking.totalPrice)}</Text>
    </Card>
  );
}

export default function TeamBookingsScreen() {
  return (
    <RequireRole
      allow={['team_manager', 'admin']}
      authMessage="Đăng nhập bằng tài khoản quản lý đội để xem lịch sân của đội."
      deniedTitle="Chưa dẫn dắt đội nào"
      deniedHint="Khu này mở ra sau khi bạn tạo một đội bóng — người tạo đội chính là quản lý đội đó."
    >
      <TeamBookingList />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  cardHead: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  team: { color: colors.text, flexShrink: 1, fontSize: fontSize.lg, fontWeight: '700' },
  place: { color: colors.text, marginTop: spacing.sm },
  slot: { color: colors.textMuted, marginTop: spacing.xs },
  price: { color: colors.primary, fontWeight: '700', marginTop: spacing.xs },
});
