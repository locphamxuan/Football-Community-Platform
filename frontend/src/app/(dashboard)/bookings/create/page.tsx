'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { CalendarDays, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SlotPicker from '@/components/bookings/SlotPicker';
import fieldService from '@/services/field.service';
import bookingService from '@/services/booking.service';
import { formatPrice } from '@/lib/format';
import type { ApiResponse, Field } from '@/types';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Tiền mặt tại sân' },
  { value: 'bank_transfer', label: 'Chuyển khoản' },
] as const;

/** Sinh mốc giờ bước 30 phút trong khung giờ mở cửa. */
const buildTimeOptions = (open: string, close: string) => {
  const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3), 10);
  const out: string[] = [];
  for (let m = toMin(open); m <= toMin(close); m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
};

/** Mirror calcPrice backend: giá theo khung giờ BẮT ĐẦU (sáng <12h, chiều <18h, tối) × số giờ. */
const previewPrice = (field: Field, date: string, startTime: string, duration: number) => {
  const isWeekend = [0, 6].includes(new Date(`${date}T00:00:00`).getDay());
  const slots = isWeekend ? field.pricing.weekend : field.pricing.weekday;
  const hour = parseInt(startTime.split(':')[0], 10);
  const pph = hour < 12 ? slots.morning : hour < 18 ? slots.afternoon : slots.evening;
  return pph * duration;
};

function CreateBookingContent() {
  const router = useRouter();
  const fieldId = useSearchParams().get('fieldId') ?? '';

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [subFieldId, setSubFieldId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash');
  const [notes, setNotes] = useState('');

  const { data: fieldRes, isPending: fieldLoading } = useQuery({
    queryKey: ['field', fieldId],
    queryFn: () => fieldService.getFieldById(fieldId),
    enabled: fieldId.length > 0,
  });
  const field = fieldRes?.data?.data?.field;

  const timeOptions = useMemo(
    () => (field ? buildTimeOptions(field.operatingHours.open, field.operatingHours.close) : []),
    [field]
  );
  const endOptions = useMemo(
    () => (startTime ? timeOptions.filter((t) => t > startTime) : []),
    [timeOptions, startTime]
  );

  const timesChosen = Boolean(date && startTime && endTime && startTime < endTime);
  const startInPast = timesChosen && new Date(`${date}T${startTime}:00`) <= new Date();

  const {
    data: availRes,
    isFetching: availLoading,
    refetch: refetchAvailability,
  } = useQuery({
    queryKey: ['availability', fieldId, date, startTime, endTime],
    queryFn: () => fieldService.checkAvailability(fieldId, { date, startTime, endTime }),
    enabled: Boolean(field) && timesChosen && !startInPast,
  });
  const availability = availRes?.data?.data?.availability ?? [];

  const duration = timesChosen
    ? (parseInt(endTime.slice(0, 2), 10) * 60 + parseInt(endTime.slice(3), 10)
        - parseInt(startTime.slice(0, 2), 10) * 60 - parseInt(startTime.slice(3), 10)) / 60
    : 0;
  const estimatedPrice = field && timesChosen ? previewPrice(field, date, startTime, duration) : 0;

  const create = useMutation({
    mutationFn: () =>
      bookingService.createBooking({ fieldId, subFieldId, date, startTime, endTime, paymentMethod, notes: notes || undefined }),
    onSuccess: () => {
      toast.success('Đặt sân thành công! Chờ chủ sân xác nhận.');
      router.push('/bookings');
    },
    onError: (err: AxiosError<ApiResponse<null>>) => {
      if (err.response?.status === 409) {
        toast.error('Khung giờ vừa bị người khác đặt — vui lòng chọn lại.');
        setSubFieldId('');
        refetchAvailability();
      } else {
        toast.error(err.response?.data?.message ?? 'Đặt sân thất bại');
      }
    },
  });

  if (!fieldId) {
    return (
      <BlockCard title="Thiếu thông tin sân" desc="Vui lòng chọn sân từ danh sách trước khi đặt.">
        <Button nativeButton={false} render={<Link href="/fields" />}>Tìm sân</Button>
      </BlockCard>
    );
  }

  if (fieldLoading) return <Skeleton className="h-96 rounded-xl" />;

  if (!field) {
    return <BlockCard title="Không tìm thấy sân" desc="Sân không tồn tại hoặc đã bị gỡ." />;
  }

  if (field.status !== 'active') {
    return (
      <BlockCard
        title="Sân chưa hoạt động"
        desc="Sân này đang chờ duyệt hoặc tạm ngưng — chưa thể nhận đặt sân."
      >
        <Button variant="outline" nativeButton={false} render={<Link href="/fields" />}>
          Tìm sân khác
        </Button>
      </BlockCard>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Đặt sân</h1>
        <p className="text-muted-foreground">
          {field.name} · {field.location.district}, {field.location.city} · Mở cửa{' '}
          {field.operatingHours.open}–{field.operatingHours.close}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" aria-hidden />
            Chọn ngày & khung giờ
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="date">Ngày đá</Label>
            <Input
              id="date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => { setDate(e.target.value); setSubFieldId(''); }}
            />
          </div>
          <div className="space-y-1">
            <Label>Giờ bắt đầu</Label>
            <Select value={startTime} onValueChange={(v) => { if (v) { setStartTime(v); setEndTime(''); setSubFieldId(''); } }}>
              <SelectTrigger><SelectValue placeholder="--:--" /></SelectTrigger>
              <SelectContent>
                {timeOptions.slice(0, -1).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Giờ kết thúc</Label>
            <Select value={endTime} onValueChange={(v) => { if (v) { setEndTime(v); setSubFieldId(''); } }}>
              <SelectTrigger><SelectValue placeholder="--:--" /></SelectTrigger>
              <SelectContent>
                {endOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {startInPast && (
            <p className="text-sm text-destructive sm:col-span-3">
              Giờ bắt đầu đã qua — vui lòng chọn khung giờ trong tương lai.
            </p>
          )}
        </CardContent>
      </Card>

      {timesChosen && !startInPast && (
        <Card>
          <CardHeader>
            <CardTitle>Chọn sân con</CardTitle>
            <CardDescription>Tình trạng trống cho {date}, {startTime}–{endTime}</CardDescription>
          </CardHeader>
          <CardContent>
            {availLoading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : (
              <SlotPicker items={availability} selectedId={subFieldId} onSelect={setSubFieldId} />
            )}
          </CardContent>
        </Card>
      )}

      {subFieldId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-primary" aria-hidden />
              Thanh toán & xác nhận
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Hình thức thanh toán</Label>
                <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v as 'cash' | 'bank_transfer')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Thanh toán trực tiếp với chủ sân, không qua app.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">Ghi chú cho chủ sân (tuỳ chọn)</Label>
                <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary/5 p-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Tạm tính ({duration} giờ, giá theo khung giờ bắt đầu)
                </p>
                <p className="font-heading text-2xl font-bold text-primary">{formatPrice(estimatedPrice)}</p>
              </div>
              <Button size="lg" onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? 'Đang đặt...' : 'Xác nhận đặt sân'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BlockCard({ title, desc, children }: { title: string; desc: string; children?: React.ReactNode }) {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardContent className="flex flex-col items-center gap-3 py-10">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export default function CreateBookingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <CreateBookingContent />
    </Suspense>
  );
}
