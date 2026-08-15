import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { ChatParticipantProfile } from '@fcp/shared';
import { Avatar, Loading, TextField } from './ui';
import { chatService } from '../services/chat.service';
import { colors, fontSize, radius, spacing } from '../lib/theme';

/** Backend đòi ít nhất 2 ký tự; hỏi sớm hơn chỉ nhận về 400. */
const MIN_TERM_LENGTH = 2;
/** Chờ người dùng ngừng gõ rồi mới hỏi — mỗi phím một request là cách làm nghẽn ô tìm kiếm. */
const DEBOUNCE_MS = 350;

/**
 * Ô tìm người: gõ tên, chạm để chọn.
 *
 * Dùng chung cho "nhắn tin mới", "tạo nhóm" và "thêm thành viên" — cùng một danh sách gợi ý,
 * chỉ khác ở chỗ giữ lại một hay nhiều người.
 */
export default function UserSearch({
  selected,
  onToggle,
  excludeIds = [],
  label = 'Tìm người',
}: {
  selected: ChatParticipantProfile[];
  onToggle: (user: ChatParticipantProfile) => void;
  /** Những người đã ở trong nhóm — hiện ra nhưng không chọn được. */
  excludeIds?: string[];
  label?: string;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ['users', 'search', debounced],
    queryFn: () => chatService.searchUsers(debounced),
    enabled: debounced.length >= MIN_TERM_LENGTH,
  });

  const selectedIds = selected.map((user) => user._id);

  return (
    <View style={styles.flex}>
      <TextField
        label={label}
        value={term}
        onChangeText={setTerm}
        placeholder="Nhập tên hoặc tên đăng nhập"
        autoCapitalize="none"
      />

      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map((user) => (
            <Pressable
              key={user._id}
              accessibilityRole="button"
              accessibilityLabel={`Bỏ chọn ${user.fullName}`}
              onPress={() => onToggle(user)}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{user.fullName} ×</Text>
            </Pressable>
          ))}
        </View>
      )}

      {debounced.length < MIN_TERM_LENGTH ? (
        <Text style={styles.hint}>Nhập ít nhất {MIN_TERM_LENGTH} ký tự để tìm</Text>
      ) : isFetching ? (
        <Loading label="Đang tìm" />
      ) : !data?.users.length ? (
        <Text style={styles.hint}>Không tìm thấy ai phù hợp</Text>
      ) : (
        <FlatList
          data={data.users}
          keyExtractor={(user) => user._id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item._id);
            const isExcluded = excludeIds.includes(item._id);

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: isExcluded }}
                disabled={isExcluded}
                onPress={() => onToggle(item)}
                style={({ pressed }) => [
                  styles.row,
                  isSelected && styles.rowSelected,
                  isExcluded && styles.rowDisabled,
                  pressed && styles.rowPressed,
                ]}
              >
                <Avatar name={item.fullName} size={32} />
                <View style={styles.rowBody}>
                  <Text style={styles.name} numberOfLines={1}>{item.fullName}</Text>
                  <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
                </View>
                {isExcluded && <Text style={styles.username}>Đã ở trong nhóm</Text>}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '600' },
  hint: { color: colors.textMuted, padding: spacing.lg, textAlign: 'center' },
  row: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
    padding: spacing.sm,
  },
  rowSelected: { backgroundColor: colors.primarySoft },
  rowDisabled: { opacity: 0.5 },
  rowPressed: { opacity: 0.7 },
  rowBody: { flex: 1 },
  name: { color: colors.text, fontSize: fontSize.md },
  username: { color: colors.textMuted, fontSize: fontSize.xs },
});
