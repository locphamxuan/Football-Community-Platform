import { Alert, FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Field } from '@fcp/shared';
import { Badge, Card, EmptyState, ErrorState, Loading } from '../components/ui';
import RequireRole from '../components/RequireRole';
import { ownerService } from '../services/owner.service';
import { messageOf } from '../lib/errors';
import { colors, fontSize, spacing, type StatusTone } from '../theme';

const STATUS_LABELS: Record<Field['status'], string> = {
  active: 'Đang nhận đặt',
  inactive: 'Tạm ngưng',
  pending_approval: 'Chờ duyệt',
};

const STATUS_TONES: Record<Field['status'], StatusTone> = {
  active: 'done',
  inactive: 'neutral',
  pending_approval: 'pending',
};

function FieldCard({
  field,
  busy,
  onToggle,
}: {
  field: Field;
  busy: boolean;
  onToggle: (field: Field, active: boolean) => void;
}) {
  return (
    <Card>
      <View style={styles.cardHead}>
        <Text style={styles.name}>{field.name}</Text>
        <Badge label={STATUS_LABELS[field.status]} tone={STATUS_TONES[field.status]} />
      </View>

      <Text style={styles.address}>{field.location?.address ?? ''}</Text>
      <Text style={styles.meta}>
        {field.subFields?.length ?? 0} sân con · {field.totalBookings ?? 0} lượt đặt
        {field.rating?.average ? ` · ${field.rating.average.toFixed(1)}★` : ''}
      </Text>

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.switchTitle}>Nhận đặt sân</Text>
          <Text style={styles.switchHint}>
            {field.isVerified
              ? 'Tắt thì khách không tìm thấy và không đặt được sân này.'
              : 'Sân phải được ban quản trị xác thực trước khi mở nhận đặt.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel={`Nhận đặt sân ${field.name}`}
          value={field.status === 'active'}
          disabled={!field.isVerified || busy}
          onValueChange={(active) => onToggle(field, active)}
        />
      </View>
    </Card>
  );
}

function OwnerFieldList() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['owner-fields'],
    queryFn: () => ownerService.myFields(),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      ownerService.setFieldStatus(id, active ? 'active' : 'inactive'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-fields'] });
      queryClient.invalidateQueries({ queryKey: ['owner-stats'] });
    },
    onError: (err) => Alert.alert('Không đổi được trạng thái', messageOf(err)),
  });

  const fields = data?.fields ?? [];

  if (isLoading) return <Loading label="Đang tải danh sách sân" />;
  if (error) return <ErrorState message={messageOf(error)} onRetry={refetch} />;

  if (fields.length === 0) {
    return (
      <EmptyState
        title="Bạn chưa có sân nào"
        hint="Tạo sân mới trên web — biểu mẫu có ảnh, bảng giá và sân con nên cần màn hình rộng."
      />
    );
  }

  return (
    <FlatList
      data={fields}
      keyExtractor={(field) => field._id}
      contentContainerStyle={styles.list}
      onRefresh={refetch}
      refreshing={isRefetching}
      renderItem={({ item }) => (
        <FieldCard
          field={item}
          busy={toggle.isPending && toggle.variables?.id === item._id}
          onToggle={(field, active) => toggle.mutate({ id: field._id, active })}
        />
      )}
    />
  );
}

export default function OwnerFieldsScreen() {
  return (
    <RequireRole
      allow={['field_owner', 'admin']}
      authMessage="Đăng nhập bằng tài khoản chủ sân để quản lý sân của bạn."
      deniedTitle="Tài khoản chưa phải chủ sân"
      deniedHint="Khu quản lý sân chỉ dành cho tài khoản có quyền chủ sân."
    >
      <OwnerFieldList />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  cardHead: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  name: { color: colors.text, flexShrink: 1, fontSize: fontSize.lg, fontWeight: '700' },
  address: { color: colors.textMuted, marginTop: spacing.xs },
  meta: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: spacing.xs },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  switchLabel: { flex: 1 },
  switchTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  switchHint: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
});
