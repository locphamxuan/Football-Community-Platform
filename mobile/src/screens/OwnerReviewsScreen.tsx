import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OwnerReview } from '@fcp/shared';
import { Badge, Button, Card, EmptyState, ErrorState, Loading, TextField } from '../components/ui';
import ChipRow from '../components/ChipRow';
import RequireRole from '../components/RequireRole';
import { ownerService } from '../services/owner.service';
import { messageOf } from '../lib/errors';
import { formatDate } from '../lib/format';
import { colors, fontSize, spacing } from '../lib/theme';

const PAGE_LIMIT = 50;

/** Chuỗi rỗng = xem tất cả; `ChipRow` chỉ làm việc với chuỗi. */
type Filter = '' | 'unanswered';

const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

function ReviewCard({
  review,
  onReply,
}: {
  review: OwnerReview;
  onReply: (review: OwnerReview) => void;
}) {
  const author = review.user?.fullName || review.user?.username || 'Khách đã xoá tài khoản';
  const replied = !!review.ownerReply?.repliedAt;

  return (
    <Card>
      <View style={styles.cardHead}>
        <Text style={styles.author}>{author}</Text>
        <Text style={styles.stars} accessibilityLabel={`${review.rating} trên 5 sao`}>
          {stars(review.rating)}
        </Text>
      </View>

      <Text style={styles.meta}>
        {review.field?.name ?? 'Sân đã gỡ'} · {formatDate(review.createdAt)}
      </Text>
      {!!review.comment && <Text style={styles.comment}>{review.comment}</Text>}

      {replied ? (
        <View style={styles.reply}>
          <Badge label="Đã phản hồi" tone="done" />
          <Text style={styles.replyText}>{review.ownerReply?.comment}</Text>
        </View>
      ) : (
        <View style={styles.action}>
          <Button
            title="Phản hồi"
            variant="outline"
            accessibilityLabel={`Phản hồi đánh giá của ${author}`}
            onPress={() => onReply(review)}
          />
        </View>
      )}
    </Card>
  );
}

function OwnerReviewList() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('');
  const [replyTo, setReplyTo] = useState<OwnerReview | null>(null);
  const [comment, setComment] = useState('');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['owner-reviews', filter],
    queryFn: () =>
      ownerService.reviews({ unanswered: filter === 'unanswered', limit: PAGE_LIMIT }),
  });

  const reply = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      ownerService.replyToReview(id, text),
    onSuccess: () => {
      setReplyTo(null);
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['owner-reviews'] });
    },
    onError: (err) => Alert.alert('Không gửi được phản hồi', messageOf(err)),
  });

  const reviews = data?.reviews ?? [];
  const unanswered = data?.unanswered ?? 0;

  if (isLoading) return <Loading label="Đang tải đánh giá" />;
  if (error) return <ErrorState message={messageOf(error)} onRetry={refetch} />;

  return (
    <View style={styles.flex}>
      <View style={styles.filters}>
        <ChipRow
          label="Lọc đánh giá"
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'unanswered', label: `Chưa phản hồi (${unanswered})` },
          ]}
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
        />
      </View>

      {replyTo && (
        <Card style={styles.replyBox}>
          <Text style={styles.replyTitle}>
            Phản hồi {replyTo.user?.fullName ?? 'khách'}
          </Text>
          <Text style={styles.replyHint}>
            Phản hồi hiển thị công khai ngay dưới đánh giá, ai xem sân cũng đọc được.
          </Text>
          <TextField
            label="Nội dung"
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={500}
            placeholder="Cảm ơn bạn đã góp ý, sân sẽ khắc phục..."
          />
          <Button
            title="Gửi phản hồi"
            disabled={!comment.trim()}
            loading={reply.isPending}
            onPress={() => reply.mutate({ id: replyTo._id, text: comment.trim() })}
          />
          <View style={styles.action}>
            <Button
              title="Để sau"
              variant="outline"
              onPress={() => {
                setReplyTo(null);
                setComment('');
              }}
            />
          </View>
        </Card>
      )}

      {reviews.length === 0 ? (
        <EmptyState
          title={filter ? 'Không còn đánh giá nào chờ phản hồi' : 'Chưa có đánh giá nào'}
          hint="Khách chỉ đánh giá được sau khi đã đá xong, nên mọi đánh giá ở đây đều là thật."
        />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(review) => review._id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => (
            <ReviewCard
              review={item}
              onReply={(review) => {
                setReplyTo(review);
                setComment('');
              }}
            />
          )}
        />
      )}
    </View>
  );
}

export default function OwnerReviewsScreen() {
  return (
    <RequireRole
      allow={['field_owner', 'admin']}
      authMessage="Đăng nhập bằng tài khoản chủ sân để đọc đánh giá về sân của bạn."
      deniedTitle="Tài khoản chưa phải chủ sân"
      deniedHint="Khu quản lý sân chỉ dành cho tài khoản có quyền chủ sân."
    >
      <OwnerReviewList />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  list: { padding: spacing.lg, paddingTop: 0 },
  cardHead: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  author: { color: colors.text, flexShrink: 1, fontSize: fontSize.lg, fontWeight: '700' },
  stars: { color: colors.warning, fontSize: fontSize.md },
  meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  comment: { color: colors.text, marginTop: spacing.sm },
  reply: { marginTop: spacing.md },
  replyText: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  action: { marginTop: spacing.md },
  replyBox: { marginHorizontal: spacing.lg },
  replyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  replyHint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
});
