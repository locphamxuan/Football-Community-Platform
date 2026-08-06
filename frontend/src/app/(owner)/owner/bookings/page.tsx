'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  UserX,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import bookingService from '@/services/booking.service';
import fieldService from '@/services/field.service';
import {
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  PAYMENT_METHODS,
} from '@/lib/constants';
import { formatDate, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ApiResponse, Booking, OwnerBooking } from '@/types';

const STATUS_TABS: { value: '' | Booking['status']; label: string }[] = [
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'no_show', label: 'Không đến' },
  { value: '', label: 'Tất cả' },
];

const ALL_FIELDS = 'all';
const PAGE_SIZE = 10;

function OwnerBookingsContent() {
  const qc = useQueryClient();
  const initialFieldId = useSearchParams().get('fieldId') ?? ALL_FIELDS;

  const [status, setStatus] = useState<'' | Booking['status']>('pending');
  const [fieldId, setFieldId] = useState(initialFieldId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<OwnerBooking | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: fieldsRes } = useQuery({
    queryKey: ['owner-fields'],
    queryFn: () => fieldService.getMyFields(),
  });
  const fields = fieldsRes?.data?.data?.fields ?? [];

  const filters = {
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(fieldId !== ALL_FIELDS ? { fieldId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['owner-bookings', filters],
    queryFn: () => bookingService.getOwnerBookings(filters),
  });
  const bookings = data?.data?.data?.bookings ?? [];
  const pagination = data?.data?.meta?.pagination;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['owner-bookings'] });
    qc.invalidateQueries({ queryKey: ['owner-stats'] });
  };

  const onError = (err: AxiosError<ApiResponse<null>>) =>
    toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra');

  const confirm = useMutation({
    mutationFn: (id: string) => bookingService.confirmBooking(id),
    onSuccess: () => {
      toast.success('Đã xác nhận lịch đặt.');
      invalidate();
    },
    onError,
  });

  const complete = useMutation({
    mutationFn: (id: string) => bookingService.completeBooking(id),
    onSuccess: () => {
      toast.success('Đã đánh dấu hoàn thành và thu tiền.');
      invalidate();
    },
    onError,
  });

  const noShow = useMutation({
    mutationFn: (id: string) => bookingService.markNoShow(id),
    onSuccess: () => {
      toast.success('Đã đánh dấu khách không đến.');
      invalidate();
    },
    onError,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      bookingService.cancelBooking(id, reason),
    onSuccess: () => {
      toast.success('Đã huỷ lịch đặt và thông báo lý do.');
      setRejecting(null);
      setRejectReason('');
      invalidate();
    },
    onError,
  });

  const busy = confirm.isPending || complete.isPending || noShow.isPending || reject.isPending;

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Lịch đặt sân</h1>
        <p className="text-muted-foreground">Xác nhận, hoàn thành hoặc huỷ lịch đặt trên sân của bạn</p>
      </div>

      {/* Bộ lọc */}
      <Card>
        <CardContent className="space-y-4 py-4">
          <Tabs
            value={status}
            onValueChange={(v) => {
              setStatus((v ?? '') as '' | Booking['status']);
              resetPage();
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

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Sân</Label>
              <Select
                value={fieldId}
                onValueChange={(v) => {
                  if (v) {
                    setFieldId(v);
                    resetPage();
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FIELDS}>Tất cả sân</SelectItem>
                  {fields.map((f) => (
                    <SelectItem key={f._id} value={f._id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="startDate">Từ ngày</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  resetPage();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">Đến ngày</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  resetPage();
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danh sách */}
      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarCheck className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold">Không có lịch đặt nào</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Không tìm thấy lịch đặt khớp với bộ lọc hiện tại.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className={cn('space-y-3', isFetching && 'opacity-60 transition-opacity')}>
          {bookings.map((b) => (
            <li key={b._id}>
              <BookingCard
                booking={b}
                busy={busy}
                onConfirm={() => confirm.mutate(b._id)}
                onComplete={() => complete.mutate(b._id)}
                onNoShow={() => noShow.mutate(b._id)}
                onReject={() => {
                  setRejecting(b);
                  setRejectReason('');
                }}
              />
            </li>
          ))}
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
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} lịch đặt
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

      {/* Huỷ / từ chối */}
      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Huỷ lịch đặt</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Lý do sẽ được hiển thị cho khách đặt sân
              {rejecting ? ` (${rejecting.user?.fullName || rejecting.user?.username})` : ''}.
            </p>
            <Label htmlFor="reject-reason">Lý do huỷ *</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              maxLength={500}
              placeholder="Sân đang bảo trì đột xuất..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Quay lại
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length === 0 || reject.isPending}
              onClick={() =>
                rejecting && reject.mutate({ id: rejecting._id, reason: rejectReason.trim() })
              }
            >
              {reject.isPending ? 'Đang huỷ...' : 'Xác nhận huỷ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingCard({
  booking: b,
  busy,
  onConfirm,
  onComplete,
  onNoShow,
  onReject,
}: {
  booking: OwnerBooking;
  busy: boolean;
  onConfirm: () => void;
  onComplete: () => void;
  onNoShow: () => void;
  onReject: () => void;
}) {
  const initials = (b.user?.fullName || b.user?.username || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  // Backend chỉ cho đánh no-show sau giờ bắt đầu
  const started = new Date(`${b.date.slice(0, 10)}T${b.startTime}:00`) <= new Date();

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-10">
              <AvatarImage src={b.user?.avatar} alt={b.user?.fullName} />
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {b.user?.fullName || b.user?.username}
                {b.team ? ` · ${b.team.name}` : ''}
              </p>
              {b.user?.phone && (
                <a
                  href={`tel:${b.user.phone}`}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Phone className="size-3.5" aria-hidden />
                  {b.user.phone}
                </a>
              )}
            </div>
          </div>
          <Badge variant="outline" className={cn('border-0', BOOKING_STATUS_COLORS[b.status])}>
            {BOOKING_STATUS_LABELS[b.status]}
          </Badge>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {b.field?.name} · {b.subFieldName}
              {b.subFieldType ? ` (${b.subFieldType})` : ''}
            </span>
          </p>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-4 shrink-0" aria-hidden />
            {formatDate(b.date)} · {b.startTime}–{b.endTime} ({b.duration}h)
          </p>
          <p className="flex items-center gap-1.5">
            <Wallet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-semibold text-primary">{formatPrice(b.totalPrice)}</span>
            <span className="text-muted-foreground">
              · {PAYMENT_METHODS[b.paymentMethod] ?? b.paymentMethod}
              {b.paymentStatus === 'paid' ? ' · đã thu' : ''}
            </span>
          </p>
        </div>

        {b.notes && (
          <p className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="font-medium">Ghi chú của khách: </span>
            {b.notes}
          </p>
        )}

        {b.status === 'cancelled' && b.cancelReason && (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <span className="font-medium">Lý do huỷ: </span>
            {b.cancelReason}
          </p>
        )}

        {(b.status === 'pending' || b.status === 'confirmed') && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {b.status === 'pending' && (
              <Button size="sm" disabled={busy} onClick={onConfirm}>
                <CheckCircle2 className="size-4" aria-hidden />
                Xác nhận
              </Button>
            )}
            {b.status === 'confirmed' && (
              <>
                <Button size="sm" disabled={busy} onClick={onComplete}>
                  <CheckCircle2 className="size-4" aria-hidden />
                  Hoàn thành
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !started}
                  title={started ? undefined : 'Chỉ đánh dấu được sau giờ bắt đầu'}
                  onClick={onNoShow}
                >
                  <UserX className="size-4" aria-hidden />
                  Khách không đến
                </Button>
              </>
            )}
            <Button variant="destructive" size="sm" disabled={busy} onClick={onReject}>
              <XCircle className="size-4" aria-hidden />
              {b.status === 'pending' ? 'Từ chối' : 'Huỷ lịch'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OwnerBookingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <OwnerBookingsContent />
    </Suspense>
  );
}
