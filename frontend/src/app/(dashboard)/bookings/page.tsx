'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MessageContextButton from '@/components/chat/MessageContextButton';
import bookingService from '@/services/booking.service';
import { formatDateLong, formatPrice } from '@/lib/format';
import type { ApiResponse, Booking } from '@/types';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '@/lib/constants';
import { CalendarDays, Clock, MapPin } from 'lucide-react';

export default function MyBookingsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; bookingId: string }>({
    open: false,
    bookingId: '',
  });
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings', statusFilter],
    queryFn: () =>
      bookingService.getMyBookings(statusFilter !== 'all' ? { status: statusFilter } : {}),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      bookingService.cancelBooking(id, reason),
    onSuccess: () => {
      toast.success('Đã huỷ lịch đặt.');
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      setCancelDialog({ open: false, bookingId: '' });
      setCancelReason('');
    },
    // Lý do từ chối là quy tắc nghiệp vụ ("phải huỷ trước giờ đá 2 tiếng") — nuốt nó đi
    // rồi báo một câu chung chung là để người dùng bấm lại mãi mà không hiểu vì sao.
    onError: (err: AxiosError<ApiResponse<null>>) =>
      toast.error(err.response?.data?.message ?? 'Không huỷ được lịch đặt'),
  });

  const bookings: Booking[] = data?.data?.data?.bookings ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">Lịch đặt sân của tôi</h1>
          <p className="text-muted-foreground">
            Huỷ được cho tới trước giờ đá 2 tiếng
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {Object.entries(BOOKING_STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>Chưa có lịch đặt sân nào.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card key={booking._id}>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{booking.field.name}</span>
                      <Badge className={BOOKING_STATUS_COLORS[booking.status]}>
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {booking.field.location.district}, {booking.field.location.city}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDateLong(booking.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {booking.startTime} – {booking.endTime}
                      </span>
                    </div>
                  </div>

                  {/* Right: price + action */}
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-bold text-primary text-lg">{formatPrice(booking.totalPrice)}</span>
                    <div className="flex items-center gap-2">
                      <MessageContextButton
                        recipientId={booking.field.owner}
                        contextType="booking"
                        contextRef={booking._id}
                        label="Nhắn chủ sân"
                      />
                      {['pending', 'confirmed'].includes(booking.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setCancelDialog({ open: true, bookingId: booking._id })}
                        >
                          Huỷ đặt sân
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cancel dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(o) => setCancelDialog((d) => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Huỷ đặt sân</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Lý do huỷ</Label>
            <Input
              id="reason"
              placeholder="Ví dụ: đội không đủ người"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog({ open: false, bookingId: '' })}>
              Đóng
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || cancelMutation.isPending}
              onClick={() => cancelMutation.mutate({ id: cancelDialog.bookingId, reason: cancelReason })}
            >
              {cancelMutation.isPending ? 'Đang huỷ...' : 'Xác nhận huỷ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
