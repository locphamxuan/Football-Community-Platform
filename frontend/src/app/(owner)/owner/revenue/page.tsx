'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, CheckCircle2, TrendingUp, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import MonthlyBarChart from '@/components/dashboard/MonthlyBarChart';
import StatCard from '@/components/dashboard/StatCard';
import bookingService from '@/services/booking.service';
import { formatCompactPrice, formatPrice } from '@/lib/format';

const RANGES = [
  { value: '3', label: '3 tháng gần nhất' },
  { value: '6', label: '6 tháng gần nhất' },
  { value: '12', label: '12 tháng gần nhất' },
];

export default function OwnerRevenuePage() {
  const [months, setMonths] = useState('6');

  const { data, isPending } = useQuery({
    queryKey: ['owner-revenue', months],
    queryFn: () => bookingService.getOwnerRevenue(Number(months)),
  });
  const series = data?.data?.data?.series ?? [];

  const totalRevenue = series.reduce((sum, p) => sum + p.revenue, 0);
  const totalBookings = series.reduce((sum, p) => sum + p.bookings, 0);
  const totalCompleted = series.reduce((sum, p) => sum + p.completed, 0);
  const totalCancelled = series.reduce((sum, p) => sum + p.cancelled, 0);
  const current = series.at(-1);
  const previous = series.at(-2);
  const delta = previous && previous.revenue > 0 && current
    ? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">Doanh thu</h1>
          <p className="text-muted-foreground">
            Tiền thu từ các lịch đặt đã hoàn thành trên sân của bạn
          </p>
        </div>
        <div className="w-52 space-y-1">
          <Label htmlFor="range">Khoảng thời gian</Label>
          <Select value={months} onValueChange={(v) => v && setMonths(v)}>
            <SelectTrigger id="range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              icon={<TrendingUp className="size-5" aria-hidden />}
              label="Tổng doanh thu"
              value={formatCompactPrice(totalRevenue)}
              hint={`Trong ${months} tháng gần nhất`}
            />
            <StatCard
              icon={<TrendingUp className="size-5" aria-hidden />}
              label="Tháng này"
              value={formatCompactPrice(current?.revenue ?? 0)}
              hint="So với tháng trước"
              delta={delta}
            />
            <StatCard
              icon={<CheckCircle2 className="size-5" aria-hidden />}
              label="Lượt hoàn thành"
              value={String(totalCompleted)}
              hint={`Trên tổng ${totalBookings} lượt đặt`}
            />
            <StatCard
              icon={<XCircle className="size-5" aria-hidden />}
              label="Lượt huỷ"
              value={String(totalCancelled)}
              hint={
                totalBookings > 0
                  ? `Tỉ lệ huỷ ${Math.round((totalCancelled / totalBookings) * 100)}%`
                  : 'Chưa có lượt đặt nào'
              }
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="size-5 text-primary" aria-hidden />
            Doanh thu theo tháng
          </CardTitle>
          <CardDescription>Chỉ tính lịch đặt ở trạng thái hoàn thành</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <MonthlyBarChart
              data={series.map((p) => ({
                label: p.label,
                value: p.revenue,
                secondary: `${p.completed}/${p.bookings} lượt hoàn thành`,
              }))}
              format={formatCompactPrice}
              seriesLabel="Doanh thu"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chi tiết theo tháng</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 font-medium">Tháng</th>
                <th scope="col" className="py-2 text-right font-medium">Lượt đặt</th>
                <th scope="col" className="py-2 text-right font-medium">Hoàn thành</th>
                <th scope="col" className="py-2 text-right font-medium">Huỷ</th>
                <th scope="col" className="py-2 text-right font-medium">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.month} className="border-b last:border-0">
                  <th scope="row" className="py-2 text-left font-normal">{p.label}</th>
                  <td className="py-2 text-right">{p.bookings}</td>
                  <td className="py-2 text-right">{p.completed}</td>
                  <td className="py-2 text-right">{p.cancelled}</td>
                  <td className="py-2 text-right font-medium">{formatPrice(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
