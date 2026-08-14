import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import type { NotificationType } from '@fcp/shared';
import { Card } from '../components/ui';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../lib/auth';
import { userService } from '../services/user.service';
import { messageOf } from '../lib/errors';
import { NOTIFICATION_TYPE_LABELS } from '../lib/format';
import { colors, fontSize, spacing } from '../lib/theme';

/**
 * Sự kiện nào sinh ra loại thông báo đó. Nhãn ngắn dùng trong hộp thư ("Lịch đặt mới")
 * không đủ để quyết định tắt hay không. Thứ tự khai báo cũng là thứ tự hiển thị.
 */
const TYPE_HINTS: Record<NotificationType, string> = {
  booking_created: 'Có người đặt một sân của bạn.',
  booking_confirmed: 'Chủ sân đã xác nhận đơn đặt của bạn.',
  booking_cancelled: 'Một đơn đặt sân bị huỷ.',
  match_request_received: 'Đội khác gửi lời mời thi đấu cho đội bạn.',
  match_request_answered: 'Đội bạn mời đã nhận hoặc từ chối lời mời.',
  match_result_submitted: 'Đối thủ vừa nhập tỉ số, chờ bạn xác nhận.',
  invoice_issued: 'Hoá đơn thuê bao mới cần thanh toán.',
  chat_message: 'Có tin nhắn mới khi bạn không mở ứng dụng.',
};

const TYPES = Object.keys(TYPE_HINTS) as NotificationType[];

interface RowProps {
  title: string;
  hint: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ title, hint, value, disabled, onChange }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      />
    </View>
  );
}

function NotificationSettingsBody() {
  const { user, refreshUser } = useAuth();

  const save = useMutation({
    mutationFn: (prefs: Parameters<typeof userService.updateNotificationPrefs>[0]) =>
      userService.updateNotificationPrefs(prefs),
    onSuccess: refreshUser,
    onError: (err) => Alert.alert('Không lưu được', messageOf(err)),
  });

  if (!user) return null;
  const muted = user.notifications?.mutedTypes ?? [];

  const toggleType = (type: NotificationType, enabled: boolean) =>
    save.mutate({
      mutedTypes: enabled ? muted.filter((t) => t !== type) : [...muted, type],
    });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.sectionTitle}>Thông báo đẩy</Text>
        <ToggleRow
          title="Gửi thông báo tới điện thoại"
          hint="Tắt thì thông báo vẫn vào hộp thư, chỉ không hiện trên màn hình khoá."
          value={user.notifications?.push ?? true}
          disabled={save.isPending}
          onChange={(value) => save.mutate({ push: value })}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Loại thông báo</Text>
        <Text style={styles.sectionHint}>
          Tắt một loại là tắt hẳn: không vào hộp thư, cũng không đẩy tới điện thoại.
          Sự kiện gốc vẫn xem được ở lịch đặt, lời mời thi đấu hoặc hoá đơn.
        </Text>
        {TYPES.map((type) => (
          <ToggleRow
            key={type}
            title={NOTIFICATION_TYPE_LABELS[type]}
            hint={TYPE_HINTS[type]}
            value={!muted.includes(type)}
            disabled={save.isPending}
            onChange={(enabled) => toggleType(type, enabled)}
          />
        ))}
      </Card>
    </ScrollView>
  );
}

export default function NotificationSettingsScreen() {
  return (
    <RequireAuth message="Đăng nhập để chỉnh tuỳ chọn thông báo.">
      <NotificationSettingsBody />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  sectionHint: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  rowLabel: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  rowHint: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
});
