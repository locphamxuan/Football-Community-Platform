import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Booking } from '@fcp/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  Screen,
  TextField,
} from '../../src/components/ui';
import ChipRow from '../../src/components/ChipRow';
import RequireAuth from '../../src/components/RequireAuth';
import ReviewDialog from '../../src/components/ReviewDialog';
import { bookingService } from '../../src/services/booking.service';
import { messageOf } from '../../src/lib/errors';
import { BOOKING_STATUS_LABELS, formatPrice, formatSlot } from '../../src/lib/format';
import { colors, fontSize, spacing } from '../../src/lib/theme';
import type { StatusTone } from '../../src/lib/theme';

const STATUS_TONES: Record<string, StatusTone> = {
  pending: 'pending',
  confirmed: 'active',
  completed: 'done',
  cancelled: 'failed',
  no_show: 'failed',
};

const FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'completed', label: 'Hoàn thành' },
];

/** Người đặt chỉ huỷ được đơn chưa đá xong, và backend còn chặn thêm cửa sổ 2 tiếng. */
const isCancellable = (booking: Booking) => ['pending', 'confirmed'].includes(booking.status);

function BookingCard({
  booking,
  onCancel,
  onReview,
  cancelling,
}: {
  booking: Booking;
  onCancel: (booking: Booking) => void;
  onReview: (booking: Booking) => void;
  cancelling: boolean;
}) {
  return (
    <Card>
      <View style={styles.cardHead}>
        <Text style={styles.fieldName}>{booking.field?.name ?? 'Sân đã gỡ'}</Text>
        <Badge
          label={BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
          tone={STATUS_TONES[booking.status] ?? 'neutral'}
        />
      </View>

      <Text style={styles.slot}>{formatSlot(booking.date, booking.startTime, booking.endTime)}</Text>
      <Text style={styles.price}>{formatPrice(booking.totalPrice)}</Text>
      {!!booking.cancelReason && (
        <Text style={styles.reason}>Lý do huỷ: {booking.cancelReason}</Text>
      )}

      {isCancellable(booking) && (
        <View style={styles.action}>
          <Button
            title="Huỷ lịch"
            variant="outline"
            onPress={() => onCancel(booking)}
            loading={cancelling}
          />
        </View>
      )}

      {booking.status === 'completed' && (
        <View style={styles.action}>
          <Button title="Đánh giá sân" variant="outline" onPress={() => onReview(booking)} />
        </View>
      )}
    </Card>
  );
}

function BookingList() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [reason, setReason] = useState('');
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['my-bookings', status],
    queryFn: () => bookingService.myBookings({ status: status || undefined, limit: 50 }),
  });

  const cancel = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => bookingService.cancel(id, why),
    onSuccess: () => {
      setCancelTarget(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: (err) => Alert.alert('Không huỷ được', messageOf(err)),
  });

  const bookings = data?.bookings ?? [];

  if (isLoading) return <Loading label="Đang tải lịch đặt" />;
  if (error) return <ErrorState message={messageOf(error)} onRetry={refetch} />;

  return (
    <View style={styles.flex}>
      <View style={styles.filters}>
        <ChipRow label="Lọc theo trạng thái" options={FILTERS} value={status} onChange={setStatus} />
      </View>

      {cancelTarget && (
        <Card style={styles.cancelBox}>
          <Text style={styles.cancelTitle}>Huỷ lịch tại {cancelTarget.field?.name}</Text>
          <Text style={styles.cancelHint}>
            Chỉ huỷ được trước giờ đá ít nhất 2 tiếng, để chủ sân còn kịp bán lại khung giờ.
          </Text>
          <TextField
            label="Lý do huỷ"
            value={reason}
            onChangeText={setReason}
            placeholder="Ví dụ: đội không đủ người"
          />
          <Button
            title="Xác nhận huỷ"
            variant="danger"
            disabled={!reason.trim()}
            loading={cancel.isPending}
            onPress={() => cancel.mutate({ id: cancelTarget._id, why: reason.trim() })}
          />
          <View style={styles.action}>
            <Button
              title="Giữ lại lịch"
              variant="outline"
              onPress={() => {
                setCancelTarget(null);
                setReason('');
              }}
            />
          </View>
        </Card>
      )}

      {reviewTarget && (
        <ReviewDialog
          fieldId={reviewTarget.field?._id ?? ''}
          fieldName={reviewTarget.field?.name ?? 'sân'}
          bookingId={reviewTarget._id}
          onClose={() => setReviewTarget(null)}
        />
      )}

      {bookings.length === 0 ? (
        <EmptyState
          title="Chưa có lịch đặt nào"
          hint="Tìm sân ở tab Tìm sân và đặt lịch đầu tiên của bạn."
        />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(booking) => booking._id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              cancelling={cancel.isPending && cancelTarget?._id === item._id}
              onCancel={setCancelTarget}
              onReview={setReviewTarget}
            />
          )}
        />
      )}
    </View>
  );
}

export default function BookingsScreen() {
  return (
    <Screen>
      <RequireAuth message="Đăng nhập để xem lịch sân bạn đã đặt.">
        <BookingList />
      </RequireAuth>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  list: { padding: spacing.lg, paddingTop: 0 },
  cardHead: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  fieldName: { color: colors.text, flexShrink: 1, fontSize: fontSize.lg, fontWeight: '700' },
  slot: { color: colors.textMuted, marginTop: spacing.sm },
  price: { color: colors.primary, fontWeight: '700', marginTop: spacing.xs },
  reason: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.sm },
  action: { marginTop: spacing.md },
  cancelBox: { marginHorizontal: spacing.lg },
  cancelTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  cancelHint: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md, marginTop: spacing.xs },
});
