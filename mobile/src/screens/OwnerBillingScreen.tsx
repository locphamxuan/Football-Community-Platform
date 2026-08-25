import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { Invoice, InvoiceStatus } from '@fcp/shared';
import {
  Badge, Button, Card, DetailRow, ErrorState, Loading, TextField,
} from '../components/ui';
import RequireRole from '../components/RequireRole';
import { ownerService } from '../services/owner.service';
import { messageOf } from '../lib/errors';
import { formatDate, formatPrice, formatQuota } from '../domain/format';
import { colors, fontSize, spacing, type StatusTone } from '../theme';

const INVOICE_LABELS: Record<InvoiceStatus, string> = {
  pending: 'Chờ thanh toán',
  awaiting_confirmation: 'Chờ đối soát',
  paid: 'Đã thanh toán',
  void: 'Đã huỷ',
};

const INVOICE_TONES: Record<InvoiceStatus, StatusTone> = {
  pending: 'pending',
  awaiting_confirmation: 'active',
  paid: 'done',
  void: 'neutral',
};

function InvoiceCard({
  invoice,
  onReport,
  onCheckout,
  checkoutPending,
}: {
  invoice: Invoice;
  onReport: (invoice: Invoice) => void;
  onCheckout: (invoice: Invoice) => void;
  checkoutPending: boolean;
}) {
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={styles.invoiceCode}>{invoice.code}</Text>
        <Badge label={INVOICE_LABELS[invoice.status]} tone={INVOICE_TONES[invoice.status]} />
      </View>
      <Text style={styles.invoiceDesc}>{invoice.description}</Text>
      <Text style={styles.amount}>{formatPrice(invoice.amount)}</Text>
      <Text style={styles.meta}>Hạn thanh toán {formatDate(invoice.dueDate)}</Text>

      {invoice.status === 'pending' && (
        <View style={styles.action}>
          <Button
            title="Thanh toán online"
            accessibilityLabel={`Thanh toán online cho hoá đơn ${invoice.code}`}
            loading={checkoutPending}
            onPress={() => onCheckout(invoice)}
          />
          <View style={styles.action}>
            <Button
              title="Tôi đã chuyển khoản"
              variant="outline"
              accessibilityLabel={`Khai báo đã chuyển khoản cho hoá đơn ${invoice.code}`}
              onPress={() => onReport(invoice)}
            />
          </View>
        </View>
      )}
      {invoice.status === 'awaiting_confirmation' && (
        <Text style={styles.meta}>
          Đã gửi mã {invoice.paymentReference} — chờ ban quản trị đối soát.
        </Text>
      )}
    </Card>
  );
}

function OwnerBillingBody() {
  const queryClient = useQueryClient();
  const [reporting, setReporting] = useState<Invoice | null>(null);
  const [reference, setReference] = useState('');

  const overview = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => ownerService.subscription(),
  });

  const invoiceList = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => ownerService.invoices({ limit: 20 }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
    queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
  };

  const autoRenew = useMutation({
    mutationFn: (value: boolean) => ownerService.setAutoRenew(value),
    onSuccess: refresh,
    onError: (err) => Alert.alert('Không đổi được thiết lập', messageOf(err)),
  });

  const reportPayment = useMutation({
    mutationFn: ({ id, ref }: { id: string; ref: string }) => ownerService.reportPayment(id, ref),
    onSuccess: () => {
      setReporting(null);
      setReference('');
      refresh();
      Alert.alert('Đã gửi', 'Ban quản trị sẽ đối soát và xác nhận hoá đơn.');
    },
    onError: (err) => Alert.alert('Không gửi được', messageOf(err)),
  });

  const checkout = useMutation({
    mutationFn: (invoiceId: string) => ownerService.checkout(invoiceId),
    onSuccess: ({ paymentUrl }) => Linking.openURL(paymentUrl),
    onError: (err) => Alert.alert('Không mở được trang thanh toán', messageOf(err)),
  });

  if (overview.isLoading) return <Loading label="Đang tải gói thuê bao" />;
  if (overview.error) {
    return <ErrorState message={messageOf(overview.error)} onRetry={overview.refetch} />;
  }
  if (!overview.data) return null;

  const { subscription, plan, usage, outstandingAmount } = overview.data;
  const invoices = invoiceList.data?.invoices ?? [];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {subscription.status === 'past_due' && (
        <Card style={styles.warning}>
          <Text style={styles.warningText}>
            Đang có hoá đơn quá hạn ({formatPrice(outstandingAmount)}). Thanh toán để được thêm
            sân mới.
          </Text>
        </Card>
      )}

      <Card>
        <Text style={styles.sectionTitle}>Gói {plan.name}</Text>
        <Text style={styles.price}>{formatPrice(plan.monthlyPrice)}/tháng</Text>

        <View style={styles.details}>
          <DetailRow label="Kỳ hiện tại đến" value={formatDate(subscription.currentPeriodEnd)} />
          <DetailRow label="Sân đang mở" value={`${usage.activeFields}/${usage.totalFields}`} />
          <DetailRow
            label="Lượt đặt tháng này"
            value={`${usage.bookingsThisMonth}/${formatQuota(plan.includedBookingsPerMonth)}`}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.switchTitle}>Tự động gia hạn</Text>
            <Text style={styles.switchHint}>
              Tắt thì hết kỳ gói tự về miễn phí, sân vượt hạn mức sẽ bị ngưng nhận đặt.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Tự động gia hạn"
            value={subscription.autoRenew}
            disabled={autoRenew.isPending}
            onValueChange={(value) => autoRenew.mutate(value)}
          />
        </View>

        <View style={styles.action}>
          <Button title="Xem bảng giá các gói" variant="outline" onPress={() => router.push('/plans')} />
        </View>
        <Text style={styles.footNote}>
          Đổi gói vẫn làm trên web — cần đối chiếu hạn mức của từng gói với số sân đang có.
        </Text>
      </Card>

      <Text style={styles.listTitle}>Hoá đơn</Text>

      {reporting && (
        <Card>
          <Text style={styles.sectionTitle}>Khai báo chuyển khoản</Text>
          <Text style={styles.switchHint}>
            Nhập mã giao dịch trên biên lai để ban quản trị đối soát hoá đơn {reporting.code}.
          </Text>
          <TextField
            label="Mã giao dịch"
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
            placeholder="Ví dụ: FT24081312345"
          />
          <Button
            title="Gửi cho ban quản trị"
            disabled={reference.trim().length < 3}
            loading={reportPayment.isPending}
            onPress={() => reportPayment.mutate({ id: reporting._id, ref: reference.trim() })}
          />
          <View style={styles.action}>
            <Button
              title="Để sau"
              variant="outline"
              onPress={() => {
                setReporting(null);
                setReference('');
              }}
            />
          </View>
        </Card>
      )}

      {invoices.length === 0 ? (
        <Text style={styles.empty}>Chưa có hoá đơn nào.</Text>
      ) : (
        invoices.map((invoice) => (
          <InvoiceCard
            key={invoice._id}
            invoice={invoice}
            onReport={(target) => {
              setReporting(target);
              setReference('');
            }}
            onCheckout={(target) => checkout.mutate(target._id)}
            checkoutPending={checkout.isPending}
          />
        ))
      )}
    </ScrollView>
  );
}

export default function OwnerBillingScreen() {
  return (
    <RequireRole
      allow={['field_owner', 'admin']}
      authMessage="Đăng nhập bằng tài khoản chủ sân để xem gói thuê bao của bạn."
      deniedTitle="Tài khoản chưa phải chủ sân"
      deniedHint="Gói thuê bao chỉ dành cho tài khoản có quyền chủ sân."
    >
      <OwnerBillingBody />
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  rowBetween: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  price: { color: colors.primary, fontSize: fontSize.xl, fontWeight: '700', marginTop: spacing.xs },
  details: { marginTop: spacing.sm },
  listTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  invoiceCode: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  invoiceDesc: { color: colors.text, marginTop: spacing.sm },
  amount: { color: colors.primary, fontWeight: '700', marginTop: spacing.xs },
  meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  action: { marginTop: spacing.md },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  switchLabel: { flex: 1 },
  switchTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  switchHint: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
  warning: { backgroundColor: colors.warningSoft },
  warningText: { color: colors.warning },
  footNote: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center' },
});
