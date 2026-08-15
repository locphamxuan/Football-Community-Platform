import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';

export interface ChipOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

/**
 * Hàng lựa chọn cuộn ngang. Dùng cho ngày, giờ và sân con trong màn đặt sân —
 * người dùng thấy hết lựa chọn mà không phải mở hộp thoại nào.
 */
export default function ChipRow({
  label,
  options,
  value,
  onChange,
  emptyHint,
}: {
  label: string;
  options: ChipOption[];
  value: string | null;
  onChange: (value: string) => void;
  emptyHint?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {options.length === 0 ? (
        <Text style={styles.empty}>{emptyHint ?? 'Không có lựa chọn nào'}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !!option.disabled }}
                accessibilityLabel={option.label}
                disabled={option.disabled}
                onPress={() => onChange(option.value)}
                style={[
                  styles.chip,
                  selected && styles.chipSelected,
                  option.disabled && styles.chipDisabled,
                ]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {option.label}
                </Text>
                {!!option.sublabel && (
                  <Text style={[styles.chipSub, selected && styles.chipTextSelected]}>
                    {option.sublabel}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm },
  empty: { color: colors.textSubtle, fontSize: fontSize.sm },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
    minWidth: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipDisabled: { opacity: 0.35 },
  chipText: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  chipSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  chipTextSelected: { color: colors.white },
});
