import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OwnerBooking } from '@fcp/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  TextField,
} from '../components/ui';
import ChipRow from '../components/ChipRow';
import RequireRole from '../components/RequireRole';
import { bookingService } from '../services/booking.service';
import { ownerService } from '../services/owner.service';
import { messageOf } from '../lib/errors';
import { BOOKING_STATUS_LABELS, formatPrice, formatSlot } from '../lib/format';
import { colors, fontSize, spacing, type StatusTone } from '../lib/theme';

const STATUS_TONES: Record<string, StatusTone> = {
  pending: 'pending',
  confirmed: 'active',
  completed: 'done',
  cancelled: 'failed',
  no_show: 'failed',
};

/** Chuỗi rỗng = không lọc; `ChipRow` chỉ làm việc với chuỗi nên không dùng `undefined` được. */
type StatusFilter = OwnerBooking['status'] | '';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: '', label: 'Tất cả' },
];

/**
 * Đánh dấu khách không đến chỉ có nghĩa sau khi giờ đá đã bắt đầu — backend chặn đúng
 * điều kiện này, ở đây chỉ giấu nút đi để không ai bấm rồi nhận về lỗi 400.
 */
const hasStarted = (booking: OwnerBooking) => {
  const [hour, minute] = booking.startTime.split(':').map(Number);
  const start = new Date(booking.date);
  start.setHours(hour, minute, 0, 0);
  return start.getTime() < Date.now();
};

interface CardProps {
  booking: OwnerBooking;
  busy: boolean;
  onConfirm: (booking: OwnerBooking) => void;
  onComplete: (booking: OwnerBooking) => void;
  onNoShow: (booking: OwnerBooking) => void;
  onCancel: (booking: OwnerBooking) => void;
}

function OwnerBookingCard({ booking, busy, onConfirm, onComplete, onNoShow, onCancel }: CardProps) {
  const customer = booking.user?.fullName || booking.user?.username || 'Khách đã xoá tài khoản';

  return (
    <Card>
      <View style={styles.cardHead}>
        <Text style={styles.customer}>{customer}</Text>
        <Badge
          label={BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
          tone={STATUS_TONES[booking.status] ?? 'neutral'}
        />
      </View>

      <Text style={styles.place}>
        {booking.field?.name ?? 'Sân đã gỡ'}
        {booking.subFieldName ? ` · ${booking.subFieldName}` : ''}
        {booking.team ? ` · ${booking.team.name}` : ''}
      </Text>
      <Text style={styles.slot}>{formatSlot(booking.date, booking.startTime, booking.endTime)}</Text>
      <Text style={styles.price}>{formatPrice(booking.totalPrice)}</Text>
      {!!booking.cancelReason && (
        <Text style={styles.reason}>Lý do huỷ: {booking.cancelReason}</Text>
      )}

      {booking.status === 'pending' && (
        <View style={styles.action}>
          <Button
            title="Xác nhận"
            accessibilityLabel={`Xác nhận lịch của ${customer}`}
            onPress={() => onConfirm(booking)}
            loading={busy}
          />
        </View>
      )}

      {booking.status === 'confirmed' && (
        <View style={styles.action}>
          <Button
            title="Hoàn thành"
            accessibilityLabel={`Hoàn thành lịch của ${customer}`}
            onPress={() => onComplete(booking)}
            loading={busy}
          />
        </View>
      )}

      {booking.status === 'confirmed' && hasStarted(booking) && (
        <View style={styles.action}>
          <Button
            title="Khách không đến"
            accessibilityLabel={`Đánh dấu ${customer} không đến`}
            variant="outline"
            onPress={() => onNoShow(booking)}
          />
        </View>
      )}

      {['pending', 'confirmed'].includes(booking.status) && (
        <View style={styles.action}>
          <Button
            title="Huỷ lịch"
            accessibilityLabel={`Huỷ lịch của ${customer}`}
            variant="danger"
            onPress={() => onCancel(booking)}
          />
        </View>
      )}
    </Card>
  );
}

function OwnerBookingList() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [cancelTarget, setCancelTarget] = useState<OwnerBooking | null>(null);
  const [reason, setReason] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['owner-bookings', status],
    queryFn: () => ownerService.bookings({ status: status || undefined, limit: 50 }),
  });

  // Số liệu trên khu quản lý đếm theo trạng thái, nên mọi thao tác đổi trạng thái đều
  // làm nó cũ đi cùng lúc với danh sách này.
  const refreshLists = () => {
    queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
    queryClient.invalidateQueries({ queryKey: ['owner-stats'] });
  };

  const act = useMutation({
    mutationFn: ({ id, run }: { id: string; run: (id: string) => Promise<unknown> }) => run(id),
    onMutate: ({ id }) => setActingOn(id),
    onSuccess: refreshLists,
    onError: (err) => Alert.alert('Không thực hiện được', messageOf(err)),
    onSettled: () => setActingOn(null),
  });

  const cancel = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => bookingService.cancel(id, why),
    onSuccess: () => {
      setCancelTarget(null);
      setReason('');
      refreshLists();
    },
    onError: (err) => Alert.alert('Không huỷ được', messageOf(err)),
  });

  const askNoShow = (booking: OwnerBooking) =>
    Alert.alert(
      'Đánh dấu khách không đến?',
      'Đơn sẽ không được tính vào doanh thu và khách nhận được ghi nhận không đến.',
      [
        { text: 'Thôi', style: 'cancel' },
        {
          text: 'Đánh dấu',
          style: 'destructive',
          onPress: () => act.mutate({ id: booking._id, run: ownerService.markNoShow }),
        },
      ]
    );

  const bookings = data?.bookings ?? [];

  if (isLoading) return <Loading label="Đang tải lịch đặt" />;
  if (error) return <ErrorState message={messageOf(error)} onRetry={refetch} />;

  return (
    <View style={styles.flex}>
      <View style={styles.filters}>
        <ChipRow
          label="Lọc theo trạng thái"
          options={FILTERS}
          value={status}
          onChange={(value) => setStatus(value as StatusFilter)}
        />
      </View>

      {cancelTarget && (
        <Card style={styles.cancelBox}>
          <Text style={styles.cancelTitle}>Huỷ lịch của {cancelTarget.user?.fullName ?? 'khách'}</Text>
          <Text style={styles.cancelHint}>
            Khách sẽ nhận được thông báo kèm lý do, nên viết cho rõ.
          </Text>
          <TextField
            label="Lý do huỷ"
            value={reason}
            onChangeText={setReason}
            placeholder="Ví dụ: sân đang sửa mặt cỏ"
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

      {bookings.length === 0 ? (
        <EmptyState
          title="Không có lịch đặt nào"
          hint="Đổi bộ lọc phía trên để xem các trạng thái khác."
        />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(booking) => booking._id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => (
            <OwnerBookingCard
              booking={item}
              busy={actingOn === item._id}
              onConfirm={(b) => act.mutate({ id: b._id, run: ownerService.confirmBooking })}
              onComplete={(b) => act.mutate({ id: b._id, run: ownerService.completeBooking })}
              onNoShow={askNoShow}
              onCancel={setCancelTarget}
            />
          )}
        />
      )}
    </View>
  );
}

export default function OwnerBookingsScreen() {
  return (
    <RequireRole
      allow={['field_owner', 'admin']}
      authMessage="Đăng nhập bằng tài khoản chủ sân để xem lịch đặt trên sân của bạn."
      deniedTitle="Tài khoản chưa phải chủ sân"
      deniedHint="Khu quản lý sân chỉ dành cho tài khoản có quyền chủ sân."
    >
      <OwnerBookingList />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  list: { padding: spacing.lg, paddingTop: 0 },
  cardHead: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  customer: { color: colors.text, flexShrink: 1, fontSize: fontSize.lg, fontWeight: '700' },
  place: { color: colors.text, marginTop: spacing.sm },
  slot: { color: colors.textMuted, marginTop: spacing.xs },
  price: { color: colors.primary, fontWeight: '700', marginTop: spacing.xs },
  reason: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.sm },
  action: { marginTop: spacing.md },
  cancelBox: { marginHorizontal: spacing.lg },
  cancelTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  cancelHint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
});
