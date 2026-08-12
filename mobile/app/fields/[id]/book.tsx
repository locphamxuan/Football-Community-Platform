import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, DetailRow, ErrorState, Loading, Screen, TextField } from '../../../src/components/ui';
import ChipRow from '../../../src/components/ChipRow';
import RequireAuth from '../../../src/components/RequireAuth';
import { fieldService } from '../../../src/services/field.service';
import { bookingService } from '../../../src/services/booking.service';
import { messageOf } from '../../../src/lib/errors';
import {
  dayOptions,
  durationHours,
  endTimeOptions,
  formatDuration,
  startTimeOptions,
} from '../../../src/lib/slots';
import { colors, fontSize, spacing } from '../../../src/lib/theme';

function BookingForm({ fieldId }: { fieldId: string }) {
  const queryClient = useQueryClient();
  const days = useMemo(() => dayOptions(), []);
  const [date, setDate] = useState(days[0].key);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [subFieldId, setSubFieldId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fieldQuery = useQuery({
    queryKey: ['field', fieldId],
    queryFn: () => fieldService.getById(fieldId),
  });
  const field = fieldQuery.data?.field;

  const starts = useMemo(
    () => (field ? startTimeOptions(field.operatingHours, date) : []),
    [field, date]
  );
  const ends = useMemo(
    () => (field && startTime ? endTimeOptions(startTime, field.operatingHours.close) : []),
    [field, startTime]
  );

  // Chỉ hỏi sân trống khi đã có đủ ngày + giờ: hỏi sớm hơn là hỏi một câu vô nghĩa.
  const availabilityQuery = useQuery({
    queryKey: ['availability', fieldId, date, startTime, endTime],
    queryFn: () => fieldService.getAvailability(fieldId, { date, startTime: startTime!, endTime: endTime! }),
    enabled: !!startTime && !!endTime,
  });

  const subFieldOptions = (availabilityQuery.data?.availability ?? []).map((sub) => ({
    value: sub.subFieldId,
    label: sub.name,
    sublabel: sub.isAvailable ? sub.fieldType : 'Đã kín',
    disabled: !sub.isAvailable,
  }));

  const createBooking = useMutation({
    mutationFn: () =>
      bookingService.create({
        fieldId,
        subFieldId: subFieldId!,
        date,
        startTime: startTime!,
        endTime: endTime!,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      Alert.alert(
        'Đã gửi yêu cầu đặt sân',
        'Chủ sân sẽ xác nhận, bạn sẽ nhận được thông báo ngay khi có kết quả.',
        [{ text: 'Xem lịch của tôi', onPress: () => router.replace('/(tabs)/bookings') }]
      );
    },
    onError: (err) => setError(messageOf(err)),
  });

  const changeStart = (value: string) => {
    setStartTime(value);
    // Giờ kết thúc cũ có thể không còn hợp lệ với giờ bắt đầu mới — bỏ luôn để khỏi gửi rác.
    setEndTime(null);
    setSubFieldId(null);
  };

  const changeEnd = (value: string) => {
    setEndTime(value);
    setSubFieldId(null);
  };

  if (fieldQuery.isLoading) return <Loading label="Đang tải sân" />;
  if (fieldQuery.error || !field) {
    return <ErrorState message={messageOf(fieldQuery.error)} onRetry={fieldQuery.refetch} />;
  }

  const ready = !!startTime && !!endTime && !!subFieldId;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.fieldName}>{field.name}</Text>
      <Text style={styles.hours}>
        Mở cửa {field.operatingHours.open} – {field.operatingHours.close}
      </Text>

      <ChipRow
        label="Chọn ngày"
        options={days.map((day) => ({ value: day.key, label: day.label, sublabel: day.dayLabel }))}
        value={date}
        onChange={(value) => {
          setDate(value);
          setStartTime(null);
          setEndTime(null);
          setSubFieldId(null);
        }}
      />

      <ChipRow
        label="Giờ bắt đầu"
        options={starts.map((time) => ({ value: time, label: time }))}
        value={startTime}
        onChange={changeStart}
        emptyHint="Hôm nay đã hết khung giờ, chọn ngày khác"
      />

      {!!startTime && (
        <ChipRow
          label="Giờ kết thúc"
          options={ends.map((time) => ({
            value: time,
            label: time,
            sublabel: formatDuration(durationHours(startTime, time)),
          }))}
          value={endTime}
          onChange={changeEnd}
        />
      )}

      {!!startTime && !!endTime && (
        <View>
          {availabilityQuery.isLoading ? (
            <Text style={styles.muted}>Đang kiểm tra sân trống…</Text>
          ) : (
            <ChipRow
              label="Chọn sân con"
              options={subFieldOptions}
              value={subFieldId}
              onChange={setSubFieldId}
              emptyHint="Khung giờ này không còn sân trống"
            />
          )}
        </View>
      )}

      <TextField
        label="Ghi chú cho chủ sân (không bắt buộc)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Ví dụ: cần thêm bóng"
        multiline
      />

      {ready && (
        <Card>
          <DetailRow label="Ngày" value={date.split('-').reverse().join('/')} />
          <DetailRow label="Khung giờ" value={`${startTime} – ${endTime}`} />
          <DetailRow
            label="Thời lượng"
            value={formatDuration(durationHours(startTime!, endTime!))}
          />
          <Text style={styles.priceNote}>
            Giá cuối do backend tính theo phần thời gian nằm trong từng khung giá, hiện ở lịch đặt
            sau khi gửi.
          </Text>
        </Card>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button
        title="Gửi yêu cầu đặt sân"
        onPress={() => {
          setError(null);
          createBooking.mutate();
        }}
        disabled={!ready}
        loading={createBooking.isPending}
      />
      <Text style={styles.footnote}>
        Đặt xong vẫn cần chủ sân xác nhận. Huỷ được miễn phí tới trước giờ đá 2 tiếng.
      </Text>
    </ScrollView>
  );
}

export default function BookFieldScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <RequireAuth message="Đăng nhập để đặt sân và theo dõi lịch của bạn.">
        <BookingForm fieldId={id} />
      </RequireAuth>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  fieldName: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  hours: { color: colors.textMuted, marginBottom: spacing.lg, marginTop: spacing.xs },
  muted: { color: colors.textMuted, marginBottom: spacing.lg },
  priceNote: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.md },
  footnote: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: spacing.md, textAlign: 'center' },
});
