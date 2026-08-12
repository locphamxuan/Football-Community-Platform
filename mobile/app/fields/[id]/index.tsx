import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import type { Review } from '@fcp/shared';
import {
  Badge,
  Button,
  Card,
  DetailRow,
  ErrorState,
  Loading,
  Screen,
} from '../../../src/components/ui';
import { fieldService } from '../../../src/services/field.service';
import { reviewService } from '../../../src/services/user.service';
import { messageOf } from '../../../src/lib/errors';
import { formatDate, formatPrice } from '../../../src/lib/format';
import { colors, fontSize, spacing } from '../../../src/lib/theme';

const SURFACE_LABELS: Record<string, string> = {
  natural_grass: 'Cỏ tự nhiên',
  artificial_grass: 'Cỏ nhân tạo',
  concrete: 'Sân xi măng',
};

function ReviewRow({ review }: { review: Review }) {
  return (
    <Card>
      <View style={styles.reviewHead}>
        <Text style={styles.reviewAuthor}>{review.user?.fullName ?? 'Người chơi'}</Text>
        <Text style={styles.reviewStars}>{'★'.repeat(review.rating)}</Text>
      </View>
      {!!review.comment && <Text style={styles.reviewBody}>{review.comment}</Text>}
      <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
      {review.ownerReply?.comment && (
        <View style={styles.reply}>
          <Text style={styles.replyLabel}>Chủ sân trả lời</Text>
          <Text style={styles.reviewBody}>{review.ownerReply.comment}</Text>
        </View>
      )}
    </Card>
  );
}

export default function FieldDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const fieldQuery = useQuery({
    queryKey: ['field', id],
    queryFn: () => fieldService.getById(id),
    enabled: !!id,
  });

  const reviewsQuery = useQuery({
    queryKey: ['field-reviews', id],
    queryFn: () => reviewService.forField(id, { limit: 10 }),
    enabled: !!id,
  });

  if (fieldQuery.isLoading) return <Screen><Loading label="Đang tải sân" /></Screen>;
  if (fieldQuery.error || !fieldQuery.data) {
    return (
      <Screen>
        <ErrorState message={messageOf(fieldQuery.error)} onRetry={fieldQuery.refetch} />
      </Screen>
    );
  }

  const { field } = fieldQuery.data;
  const reviews = reviewsQuery.data?.reviews ?? [];
  const canBook = field.status === 'active' && field.isVerified;

  return (
    <Screen>
      <FlatList
        data={reviews}
        keyExtractor={(review) => review._id}
        renderItem={({ item }) => <ReviewRow review={item} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.name}>{field.name}</Text>
            <Text style={styles.address}>
              {[field.location?.address, field.location?.district, field.location?.city]
                .filter(Boolean)
                .join(', ')}
            </Text>

            <View style={styles.badges}>
              <Badge
                label={canBook ? 'Đang nhận đặt' : 'Tạm ngừng nhận đặt'}
                tone={canBook ? 'done' : 'neutral'}
              />
              {field.rating?.count > 0 && (
                <Badge label={`★ ${field.rating.average.toFixed(1)} · ${field.rating.count} đánh giá`} />
              )}
            </View>

            {!!field.description && <Text style={styles.description}>{field.description}</Text>}

            <Card>
              <Text style={styles.sectionTitle}>Bảng giá theo giờ</Text>
              <DetailRow label="Ngày thường · sáng" value={formatPrice(field.pricing.weekday.morning)} />
              <DetailRow label="Ngày thường · chiều" value={formatPrice(field.pricing.weekday.afternoon)} />
              <DetailRow label="Ngày thường · tối" value={formatPrice(field.pricing.weekday.evening)} />
              <DetailRow label="Cuối tuần · tối" value={formatPrice(field.pricing.weekend.evening)} />
              <Text style={styles.priceNote}>
                Đặt vắt qua hai khung giờ được tính theo đúng phần thời gian của từng khung.
              </Text>
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Giờ mở cửa</Text>
              <DetailRow
                label="Hằng ngày"
                value={`${field.operatingHours.open} – ${field.operatingHours.close}`}
              />
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Sân con ({field.subFields.length})</Text>
              {field.subFields.map((sub) => (
                <DetailRow
                  key={sub._id}
                  label={sub.name}
                  value={`${sub.fieldType} · ${SURFACE_LABELS[sub.surface] ?? sub.surface}`}
                />
              ))}
            </Card>

            <View style={styles.bookAction}>
              <Button
                title={canBook ? 'Đặt sân này' : 'Sân chưa nhận đặt'}
                disabled={!canBook}
                onPress={() => router.push(`/fields/${field._id}/book`)}
              />
            </View>

            <Text style={styles.sectionTitle}>Đánh giá</Text>
            {reviewsQuery.isLoading && <Text style={styles.muted}>Đang tải đánh giá…</Text>}
            {!reviewsQuery.isLoading && reviews.length === 0 && (
              <Text style={styles.muted}>Chưa có đánh giá nào cho sân này.</Text>
            )}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  name: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  address: { color: colors.textMuted, marginTop: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.md },
  description: { color: colors.textMuted, marginBottom: spacing.lg },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  priceNote: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: spacing.sm },
  bookAction: { marginBottom: spacing.xl },
  muted: { color: colors.textMuted },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between' },
  reviewAuthor: { color: colors.text, fontWeight: '600' },
  reviewStars: { color: colors.warning },
  reviewBody: { color: colors.textMuted, marginTop: spacing.xs },
  reviewDate: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: spacing.sm },
  reply: {
    borderLeftColor: colors.border,
    borderLeftWidth: 2,
    marginTop: spacing.md,
    paddingLeft: spacing.md,
  },
  replyLabel: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '700' },
});
