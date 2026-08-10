'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { AlertTriangle, Check, CreditCard, ReceiptText, Volleyball } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import billingService from '@/services/billing.service';
import {
  INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS,
  SUBSCRIPTION_STATUS_COLORS, SUBSCRIPTION_STATUS_LABELS,
} from '@/lib/constants';
import { formatDate, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ApiResponse, Invoice, PlanCode } from '@/types';

export default function OwnerBillingPage() {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [reference, setReference] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => billingService.getSubscription(),
  });
  const overview = data?.data?.data;

  const { data: invoicesRes } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => billingService.getInvoices({ limit: 20 }),
  });
  const invoices = invoicesRes?.data?.data?.invoices ?? [];

  const onError = (err: AxiosError<ApiResponse<null>>) =>
    toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['billing-subscription'] });
    qc.invalidateQueries({ queryKey: ['billing-invoices'] });
  };

  const changePlan = useMutation({
    mutationFn: (plan: PlanCode) => billingService.changePlan(plan),
    onSuccess: (res) => {
      const invoice = res.data.data.invoice;
      toast.success(
        invoice
          ? `Đã đổi gói. Hoá đơn ${invoice.code} (${formatPrice(invoice.amount)}) đang chờ thanh toán.`
          : 'Đã chuyển về gói miễn phí.'
      );
      invalidate();
    },
    onError,
  });

  const autoRenew = useMutation({
    mutationFn: (value: boolean) => billingService.setAutoRenew(value),
    onSuccess: () => {
      toast.success('Đã cập nhật thiết lập gia hạn.');
      invalidate();
    },
    onError,
  });

  const reportPayment = useMutation({
    mutationFn: ({ id, ref }: { id: string; ref: string }) => billingService.reportPayment(id, ref),
    onSuccess: () => {
      toast.success('Đã gửi thông tin chuyển khoản. Quản trị viên sẽ đối soát.');
      setPaying(null);
      setReference('');
      invalidate();
    },
    onError,
  });

  if (isPending || !overview) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { subscription, plan, plans, usage, outstandingAmount } = overview;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Gói dịch vụ</h1>
        <p className="text-muted-foreground">
          Phí thuê nền tảng — tách biệt với tiền khách đặt sân trả cho bạn
        </p>
      </div>

      {subscription.status === 'past_due' && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" aria-hidden />
            <p className="min-w-0 flex-1 text-sm">
              Bạn đang có hoá đơn chưa thanh toán ({formatPrice(outstandingAmount)}). Thanh toán để
              tiếp tục thêm sân mới.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Gói hiện tại + mức sử dụng */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-primary" aria-hidden />
            Gói hiện tại: {plan.name}
          </CardTitle>
          <CardDescription>
            Chu kỳ {formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className={cn('border-0', SUBSCRIPTION_STATUS_COLORS[subscription.status])}
            >
              {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {plan.monthlyPrice > 0 ? `${formatPrice(plan.monthlyPrice)}/tháng` : 'Không mất phí'}
            </span>
            <span className="text-sm text-muted-foreground">
              · Đã trả tổng cộng <strong className="text-foreground">{formatPrice(subscription.totalPaid)}</strong>
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <UsageMeter
              label="Sân đang dùng"
              used={usage.totalFields}
              limit={plan.maxFields}
              suffix="sân"
            />
            <UsageMeter
              label="Sân con"
              used={usage.totalSubFields}
              limit={plan.maxSubFieldsPerField * Math.max(usage.totalFields, 1)}
              suffix="sân con"
            />
            <UsageMeter
              label="Lượt đặt tháng này"
              used={usage.bookingsThisMonth}
              limit={plan.includedBookingsPerMonth}
              suffix="lượt"
            />
          </div>

          {plan.monthlyPrice > 0 && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="auto-renew" className="font-medium">Tự động gia hạn</Label>
                <p className="text-xs text-muted-foreground">
                  Tắt thì hết chu kỳ tài khoản sẽ tự về gói miễn phí.
                </p>
              </div>
              <Switch
                id="auto-renew"
                checked={subscription.autoRenew}
                onCheckedChange={(v) => autoRenew.mutate(Boolean(v))}
                disabled={autoRenew.isPending}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bảng giá */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.code === subscription.plan;
          return (
            <Card key={p.code} className={cn(isCurrent && 'border-primary/50 bg-primary/5')}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {p.name}
                  {isCurrent && <Badge variant="outline">Đang dùng</Badge>}
                </CardTitle>
                <CardDescription>
                  {p.monthlyPrice > 0 ? `${formatPrice(p.monthlyPrice)} / tháng` : 'Miễn phí'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={isCurrent || changePlan.isPending}
                  onClick={() => changePlan.mutate(p.code)}
                >
                  {isCurrent ? 'Gói hiện tại' : p.monthlyPrice > 0 ? 'Nâng cấp' : 'Chuyển về gói này'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Hoá đơn */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" aria-hidden />
            Hoá đơn
          </CardTitle>
          <CardDescription>
            Chuyển khoản xong hãy bấm &quot;Tôi đã chuyển khoản&quot; để quản trị viên đối soát.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có hoá đơn nào.</p>
          ) : (
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 font-medium">Mã</th>
                  <th scope="col" className="py-2 font-medium">Nội dung</th>
                  <th scope="col" className="py-2 font-medium">Hạn trả</th>
                  <th scope="col" className="py-2 text-right font-medium">Số tiền</th>
                  <th scope="col" className="py-2 text-right font-medium">Trạng thái</th>
                  <th scope="col" className="py-2" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id} className="border-b last:border-0">
                    <th scope="row" className="py-2.5 text-left font-mono text-xs font-normal">{inv.code}</th>
                    <td className="py-2.5">{inv.description}</td>
                    <td className="py-2.5">{formatDate(inv.dueDate)}</td>
                    <td className="py-2.5 text-right font-medium">{formatPrice(inv.amount)}</td>
                    <td className="py-2.5 text-right">
                      <Badge variant="outline" className={cn('border-0', INVOICE_STATUS_COLORS[inv.status])}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      {inv.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPaying(inv);
                            setReference('');
                          }}
                        >
                          Tôi đã chuyển khoản
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={paying !== null} onOpenChange={(open) => !open && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận đã chuyển khoản</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Hoá đơn {paying?.code} · {paying ? formatPrice(paying.amount) : ''}. Nhập mã giao dịch
              để quản trị viên đối chiếu với sao kê.
            </p>
            <Label htmlFor="payment-ref">Mã giao dịch *</Label>
            <Input
              id="payment-ref"
              placeholder="FT24080912345"
              value={reference}
              maxLength={100}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>
              Quay lại
            </Button>
            <Button
              disabled={reference.trim().length < 3 || reportPayment.isPending}
              onClick={() => paying && reportPayment.mutate({ id: paying._id, ref: reference.trim() })}
            >
              {reportPayment.isPending ? 'Đang gửi...' : 'Gửi xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Thanh đo mức sử dụng so với hạn mức gói; -1 nghĩa là không giới hạn. */
function UsageMeter({
  label,
  used,
  limit,
  suffix,
}: {
  label: string;
  used: number;
  limit: number;
  suffix: string;
}) {
  const unlimited = limit < 0;
  const ratio = unlimited ? 0 : Math.min(used / Math.max(limit, 1), 1);
  const nearLimit = !unlimited && ratio >= 0.8;

  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Volleyball className="size-4" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="font-heading text-lg font-bold">
        {used}
        <span className="text-sm font-normal text-muted-foreground">
          {unlimited ? ` ${suffix} · không giới hạn` : ` / ${limit} ${suffix}`}
        </span>
      </p>
      {!unlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', nearLimit ? 'bg-amber-500' : 'bg-primary')}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
