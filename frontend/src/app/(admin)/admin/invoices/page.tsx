'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { CheckCircle2, ReceiptText, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import adminService from '@/services/admin.service';
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from '@/lib/constants';
import { formatDate, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ApiResponse, Invoice, InvoiceStatus } from '@/types';

const STATUS_TABS: { value: '' | InvoiceStatus; label: string }[] = [
  { value: 'awaiting_confirmation', label: 'Chờ đối soát' },
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'void', label: 'Đã huỷ' },
  { value: '', label: 'Tất cả' },
];

const PAGE_SIZE = 10;

/** Chủ sân được populate khi admin xem — string nghĩa là chưa populate. */
const ownerOf = (invoice: Invoice) =>
  typeof invoice.owner === 'string' ? null : invoice.owner;

function AdminInvoicesContent() {
  const qc = useQueryClient();
  const initialStatus = (useSearchParams().get('status') ?? 'awaiting_confirmation') as '' | InvoiceStatus;

  const [status, setStatus] = useState<'' | InvoiceStatus>(initialStatus);
  const [page, setPage] = useState(1);
  const [voiding, setVoiding] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const filters = { page, limit: PAGE_SIZE, ...(status ? { status } : {}) };

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['admin-invoices', filters],
    queryFn: () => adminService.getInvoices(filters),
  });
  const invoices = data?.data?.data?.invoices ?? [];
  const pagination = data?.data?.meta?.pagination;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-invoices'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  const onError = (err: AxiosError<ApiResponse<null>>) =>
    toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra');

  const confirm = useMutation({
    mutationFn: (id: string) => adminService.confirmInvoice(id),
    onSuccess: () => {
      toast.success('Đã xác nhận hoá đơn là đã thanh toán.');
      invalidate();
    },
    onError,
  });

  const voidInvoice = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminService.voidInvoice(id, reason),
    onSuccess: () => {
      toast.success('Đã huỷ hoá đơn.');
      setVoiding(null);
      setVoidReason('');
      invalidate();
    },
    onError,
  });

  const busy = confirm.isPending || voidInvoice.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Hoá đơn thuê bao</h1>
        <p className="text-muted-foreground">
          Chủ sân chuyển khoản rồi báo mã giao dịch — bạn đối chiếu sao kê và xác nhận
        </p>
      </div>

      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus((v ?? '') as '' | InvoiceStatus);
          setPage(1);
        }}
      >
        <TabsList className="flex-wrap">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value || 'all'} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ReceiptText className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold">Không có hoá đơn nào</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Không tìm thấy hoá đơn khớp với bộ lọc hiện tại.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className={cn('space-y-3', isFetching && 'opacity-60 transition-opacity')}>
          {invoices.map((inv) => {
            const owner = ownerOf(inv);
            return (
              <li key={inv._id}>
                <Card>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{inv.code}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {owner ? `${owner.fullName || owner.username} · ${owner.email}` : 'Chủ sân đã bị gỡ'}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn('border-0', INVOICE_STATUS_COLORS[inv.status])}>
                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                    </div>

                    <dl className="grid gap-2 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-muted-foreground">Số tiền</dt>
                        <dd className="font-semibold text-primary">{formatPrice(inv.amount)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Kỳ thuê bao</dt>
                        <dd>
                          {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Hạn thanh toán</dt>
                        <dd>{formatDate(inv.dueDate)}</dd>
                      </div>
                    </dl>

                    <p className="text-sm text-muted-foreground">{inv.description}</p>

                    {inv.paymentReference && (
                      <p className="rounded-lg bg-muted/50 p-3 text-sm">
                        <span className="font-medium">Mã giao dịch chủ sân báo: </span>
                        {inv.paymentReference}
                        {inv.reportedAt ? ` (báo lúc ${formatDate(inv.reportedAt)})` : ''}
                      </p>
                    )}

                    {inv.status === 'void' && inv.voidReason && (
                      <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        <span className="font-medium">Lý do huỷ: </span>
                        {inv.voidReason}
                      </p>
                    )}

                    {inv.status === 'paid' && inv.paidAt && (
                      <p className="text-sm text-muted-foreground">Đã xác nhận thanh toán {formatDate(inv.paidAt)}.</p>
                    )}

                    {(inv.status === 'awaiting_confirmation' || inv.status === 'pending') && (
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        <Button size="sm" disabled={busy} onClick={() => confirm.mutate(inv._id)}>
                          <CheckCircle2 className="size-4" aria-hidden />
                          Xác nhận đã nhận tiền
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setVoiding(inv);
                            setVoidReason('');
                          }}
                        >
                          <XCircle className="size-4" aria-hidden />
                          Huỷ hoá đơn
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasPrevPage || isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            Trang trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} hoá đơn
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasNextPage || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Trang sau
          </Button>
        </div>
      )}

      <Dialog open={voiding !== null} onOpenChange={(open) => !open && setVoiding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Huỷ hoá đơn {voiding?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Hoá đơn đã huỷ không còn tính vào công nợ của chủ sân. Lý do sẽ hiển thị ở trang thuê bao của họ.
            </p>
            <Label htmlFor="void-reason">Lý do huỷ</Label>
            <Textarea
              id="void-reason"
              rows={3}
              maxLength={500}
              placeholder="Hoá đơn trùng, đã xuất lại hoá đơn khác..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(null)}>
              Quay lại
            </Button>
            <Button
              variant="destructive"
              disabled={voidInvoice.isPending}
              onClick={() => voiding && voidInvoice.mutate({ id: voiding._id, reason: voidReason.trim() })}
            >
              {voidInvoice.isPending ? 'Đang huỷ...' : 'Xác nhận huỷ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminInvoicesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <AdminInvoicesContent />
    </Suspense>
  );
}
