import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, TextField } from './ui';
import { reviewService } from '../services/user.service';
import { messageOf } from '../lib/errors';
import { colors, fontSize, spacing } from '../lib/theme';

const STARS = [1, 2, 3, 4, 5];

/**
 * Viết đánh giá cho một lượt đặt đã hoàn thành.
 *
 * Không kèm ảnh: chọn ảnh cần thêm quyền và thêm một thư viện nữa, trong khi phần lớn
 * đánh giá chỉ là sao + vài câu. Web vẫn gửi được ảnh nếu người dùng cần.
 */
export default function ReviewDialog({
  fieldId,
  fieldName,
  bookingId,
  onClose,
}: {
  fieldId: string;
  fieldName: string;
  bookingId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      reviewService.create({
        fieldId,
        rating,
        bookingId,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-reviews', fieldId] });
      Alert.alert('Cảm ơn bạn', 'Đánh giá của bạn đã được gửi.');
      onClose();
    },
    onError: (err) => Alert.alert('Không gửi được đánh giá', messageOf(err)),
  });

  return (
    <Card style={styles.box}>
      <Text style={styles.title}>Đánh giá {fieldName}</Text>

      <View style={styles.stars}>
        {STARS.map((star) => (
          <Pressable
            key={star}
            accessibilityRole="button"
            accessibilityLabel={`${star} sao`}
            accessibilityState={{ selected: star <= rating }}
            onPress={() => setRating(star)}
          >
            <Text style={[styles.star, star <= rating && styles.starOn]}>★</Text>
          </Pressable>
        ))}
      </View>

      <TextField
        label="Nhận xét (không bắt buộc)"
        value={comment}
        onChangeText={setComment}
        placeholder="Mặt sân, đèn, phòng thay đồ…"
        multiline
      />

      <Button title="Gửi đánh giá" onPress={() => submit.mutate()} loading={submit.isPending} />
      <View style={styles.cancel}>
        <Button title="Để sau" variant="outline" onPress={onClose} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: spacing.lg },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  star: { color: colors.border, fontSize: 32 },
  starOn: { color: colors.warning },
  cancel: { marginTop: spacing.md },
});
