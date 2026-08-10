import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import type { Plan } from '@fcp/shared';
import { apiFetch } from '../lib/api';
import { formatPrice, formatQuota } from '../lib/format';

/**
 * Màn hình đầu tiên của app: bảng giá thuê bao.
 * Dùng endpoint công khai /billing/plans nên chạy được ngay khi chưa có màn đăng nhập,
 * đồng thời chứng minh mobile đọc đúng hợp đồng API trong shared/types.ts.
 */
export default function PlansScreen() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const data = await apiFetch<{ plans: Plan[] }>('/billing/plans', { signal });
      setPlans(data.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!plans) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Đang tải bảng giá" />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={plans}
      keyExtractor={(plan) => plan.code}
      ListHeaderComponent={<Text style={styles.heading}>Gói thuê bao chủ sân</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.planName}>{item.name}</Text>
          <Text style={styles.price}>{formatPrice(item.monthlyPrice)}/tháng</Text>
          <Text style={styles.meta}>
            {item.maxFields} sân · {formatQuota(item.includedBookingsPerMonth)} lượt đặt mỗi tháng
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  list: { padding: 16, paddingTop: 64 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: '#f4f4f5', borderRadius: 12, marginBottom: 12, padding: 16 },
  planName: { fontSize: 16, fontWeight: '600' },
  price: { color: '#15803d', fontSize: 18, fontWeight: '700', marginTop: 4 },
  meta: { color: '#52525b', marginTop: 4 },
  error: { color: '#b91c1c', textAlign: 'center' },
});
