'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { CalendarCheck, Clock, MapPin, Wallet, XCircle } from 'lucide-react';
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
import teamService from '@/services/team.service';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS, PAYMENT_METHODS } from '@/lib/constants';
import { formatDate, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import useAuthStore from '@/stores/authStore';
import type { ApiResponse, Booking, TeamBooking } from '@/types';

const STATUS_TABS: { value: '' | Booking['status']; label: string }[] = [
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã huỷ' },
  { value: '', label: 'Tất cả' },
];

const ALL_TEAMS = 'all';
const PAGE_SIZE = 10;

/** user trong booking đã populate — id có thể là `id` hoặc `_id` tuỳ transform. */
const bookerId = (b: TeamBooking) =>
  (b.user as unknown as { _id?: string; id?: string })?._id ?? b.user?.id ?? '';

export default function ManagerBookingsPage() {
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [status, setStatus] = useState<'' | Booking['status']>('confirmed');
  const [teamId, setTeamId] = useState(ALL_TEAMS);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<TeamBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data: dashboardRes } = useQuery({
    queryKey: ['manager-dashboard'],
    queryFn: () => teamService.getManagerDashboard(),
  });
  const myTeams = dashboardRes?.data?.data?.teams ?? [];

  const filters = {
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(teamId !== ALL_TEAMS ? { teamId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['manager-bookings', filters],
    queryFn: () => bookingService.getTeamBookings(filters),
  });
  const bookings = data?.data?.data?.bookings ?? [];
  const pagination = data?.data?.meta?.pagination;

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => bookingService.cancelBooking(id, reason),
    onSuccess: () => {
      toast.success('Đã huỷ lịch đặt.');
      setCancelling(null);
      setCancelReason('');
      qc.invalidateQueries({ queryKey: ['manager-bookings'] });
      qc.invalidateQueries({ queryKey: ['manager-dashboard'] });
    },
    onError: (err: AxiosError<ApiResponse<null>>) =>
      toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra'),
  });

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">Lịch sân của đội</h1>
          <p className="text-muted-foreground">Mọi lịch đặt gắn với đội bạn quản lý, ai đặt cũng hiện ở đây</p>
        </div>
        <Button nativeButton={false} render={<Link href="/fields" />}>
          Đặt sân mới
        </Button>
      </div>

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
              <Label htmlFor="team-filter">Đội</Label>
              <Select
                value={teamId}
                onValueChange={(v) => {
                  if (v) {
                    setTeamId(v);
                    resetPage();
                  }
                }}
              >
                <SelectTrigger id="team-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TEAMS}>Tất cả đội của tôi</SelectItem>
                  {myTeams.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
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
              Lịch chỉ hiện ở đây khi người đặt chọn đội của bạn lúc đặt sân.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className={cn('space-y-3', isFetching && 'opacity-60 transition-opacity')}>
          {bookings.map((b) => {
            const canCancel =
              ['pending', 'confirmed'].includes(b.status) && bookerId(b) === currentUserId;
            return (
              <li key={b._id}>
                <Card>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/fields/${b.field?._id}`} className="font-medium hover:text-primary">
                          {b.field?.name}
                        </Link>
                        <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          {b.field?.location?.district}, {b.field?.location?.city}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {b.team && <Badge variant="outline">{b.team.name}</Badge>}
                        <Badge variant="outline" className={cn('border-0', BOOKING_STATUS_COLORS[b.status])}>
                          {BOOKING_STATUS_LABELS[b.status] ?? b.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="size-4 shrink-0" aria-hidden />
                        {formatDate(b.date)} · {b.startTime}–{b.endTime} ({b.duration}h)
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Wallet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="font-semibold text-primary">{formatPrice(b.totalPrice)}</span>
                        <span className="text-muted-foreground">
                          · {PAYMENT_METHODS[b.paymentMethod] ?? b.paymentMethod}
                          {b.paymentStatus === 'paid' ? ' · đã thanh toán' : ''}
                        </span>
                      </p>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Người đặt: {b.user?.fullName || b.user?.username}
                      {bookerId(b) === currentUserId ? ' (bạn)' : ''}
                    </p>

                    {b.status === 'cancelled' && b.cancelReason && (
                      <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        <span className="font-medium">Lý do huỷ: </span>
                        {b.cancelReason}
                      </p>
                    )}

                    {canCancel && (
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={cancel.isPending}
                          onClick={() => {
                            setCancelling(b);
                            setCancelReason('');
                          }}
                        >
                          <XCircle className="size-4" aria-hidden />
                          Huỷ lịch
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

      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Huỷ lịch đặt</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Chỉ huỷ được trước giờ đá ít nhất 2 tiếng. Sau mốc đó hãy liên hệ trực tiếp chủ sân.
            </p>
            <Label htmlFor="cancel-reason">Lý do huỷ *</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              maxLength={500}
              placeholder="Đội không đủ người..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>
              Quay lại
            </Button>
            <Button
              variant="destructive"
              disabled={cancelReason.trim().length === 0 || cancel.isPending}
              onClick={() => cancelling && cancel.mutate({ id: cancelling._id, reason: cancelReason.trim() })}
            >
              {cancel.isPending ? 'Đang huỷ...' : 'Xác nhận huỷ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
