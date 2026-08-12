import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { Field } from '@fcp/shared';
import { EmptyState, ErrorState, Loading, Screen } from '../../src/components/ui';
import { fieldService } from '../../src/services/field.service';
import { messageOf } from '../../src/lib/errors';
import { formatPrice } from '../../src/lib/format';
import { colors, fontSize, radius, spacing } from '../../src/lib/theme';

const PAGE_SIZE = 20;

/** Giá buổi tối ngày thường là con số người chơi thật sự so sánh khi chọn sân. */
const headlinePrice = (field: Field) => field.pricing?.weekday?.evening ?? 0;

function FieldRow({ field }: { field: Field }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/fields/${field._id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.name}>{field.name}</Text>
      <Text style={styles.location}>
        {[field.location?.district, field.location?.city].filter(Boolean).join(', ')}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.price}>{formatPrice(headlinePrice(field))}/giờ</Text>
        <Text style={styles.rating}>
          {field.rating?.count > 0
            ? `★ ${field.rating.average.toFixed(1)} (${field.rating.count})`
            : 'Chưa có đánh giá'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function FieldsScreen() {
  const [search, setSearch] = useState('');
  // Chỉ tìm khi người dùng bấm Enter: gõ tới đâu gọi API tới đó là mỗi ký tự một request.
  const [submitted, setSubmitted] = useState('');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['fields', submitted],
    queryFn: () => fieldService.search({ search: submitted || undefined, limit: PAGE_SIZE }),
  });

  const fields = data?.fields ?? [];

  return (
    <Screen>
      <View style={styles.searchBar}>
        <TextInput
          accessibilityLabel="Tìm sân theo tên hoặc khu vực"
          placeholder="Tìm sân theo tên hoặc khu vực"
          placeholderTextColor={colors.textSubtle}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => setSubmitted(search.trim())}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>

      {isLoading ? (
        <Loading label="Đang tải danh sách sân" />
      ) : error ? (
        <ErrorState message={messageOf(error)} onRetry={refetch} />
      ) : fields.length === 0 ? (
        <EmptyState
          title="Không tìm thấy sân nào"
          hint={submitted ? `Không có kết quả cho "${submitted}"` : 'Chưa có sân nào được duyệt'}
        />
      ) : (
        <FlatList
          data={fields}
          keyExtractor={(field) => field._id}
          renderItem={({ item }) => <FieldRow field={item} />}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: { padding: spacing.lg, paddingBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: fontSize.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  cardPressed: { opacity: 0.7 },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  location: { color: colors.textMuted, marginTop: spacing.xs },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  price: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  rating: { color: colors.textMuted, fontSize: fontSize.sm },
});
