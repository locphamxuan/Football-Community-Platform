import { FlatList, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { Plan } from '@fcp/shared';
import { Card, ErrorState, Loading } from '../components/ui';
import { apiFetch } from '../lib/api';
import { messageOf } from '../lib/errors';
import { formatPrice, formatQuota } from '../lib/format';
import { colors, fontSize, spacing } from '../lib/theme';

/**
 * Bảng giá thuê bao. Dùng endpoint công khai `/billing/plans` nên xem được cả khi chưa
 * đăng nhập — chủ sân tương lai phải biết giá trước khi tạo tài khoản. Chủ sân đang dùng
 * xem gói *của mình* ở `owner/billing`, màn này chỉ để so sánh các gói.
 */
export default function PlansScreen() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiFetch<{ plans: Plan[] }>('/billing/plans'),
  });

  if (isLoading) return <Loading label="Đang tải bảng giá" />;
  if (error) return <ErrorState message={messageOf(error)} onRetry={refetch} />;

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={data?.plans ?? []}
      keyExtractor={(plan) => plan.code}
      ListHeaderComponent={<Text style={styles.heading}>Gói thuê bao chủ sân</Text>}
      renderItem={({ item }) => (
        <Card>
          <Text style={styles.planName}>{item.name}</Text>
          <Text style={styles.price}>{formatPrice(item.monthlyPrice)}/tháng</Text>
          <Text style={styles.meta}>
            {item.maxFields} sân · {formatQuota(item.includedBookingsPerMonth)} lượt đặt mỗi tháng
          </Text>
          {item.features.map((feature) => (
            <Text key={feature} style={styles.feature}>
              • {feature}
            </Text>
          ))}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  heading: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  planName: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  price: { color: colors.primary, fontSize: fontSize.xl, fontWeight: '700', marginTop: spacing.xs },
  meta: { color: colors.textMuted, marginTop: spacing.xs },
  feature: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
});
