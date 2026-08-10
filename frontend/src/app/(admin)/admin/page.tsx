'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  CalendarRange,
  ClipboardCheck,
  Coins,
  ReceiptText,
  TrendingUp,
  Users,
  Volleyball,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import MonthlyBarChart from '@/components/dashboard/MonthlyBarChart';
import StatCard from '@/components/dashboard/StatCard';
import adminService from '@/services/admin.service';
import { formatCompactPrice, formatPrice } from '@/lib/format';

const RANGES = [
  { value: '3', label: '3 tháng gần nhất' },
  { value: '6', label: '6 tháng gần nhất' },
  { value: '12', label: '12 tháng gần nhất' },
];

export default function AdminOverviewPage() {
  const [months, setMonths] = useState('6');

  const { data: overviewRes, isPending } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminService.getOverview(),
  });
  const overview = overviewRes?.data?.data?.overview;

  const { data: seriesRes, isPending: seriesPending } = useQuery({
    queryKey: ['admin-revenue', months],
    queryFn: () => adminService.getRevenueSeries(Number(months)),
  });
  const series = seriesRes?.data?.data?.series ?? [];

  const current = series.at(-1);
  const previous = series.at(-2);
  const delta =
    previous && previous.platformRevenue > 0 && current
      ? Math.round(((current.platformRevenue - previous.platformRevenue) / previous.platformRevenue) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Tổng quan nền tảng</h1>
        <p className="text-muted-foreground">
          Doanh thu nền tảng là tiền chủ sân trả để thuê hệ thống — tách khỏi tiền khách đặt sân
        </p>
      </div>

      {/* Doanh thu nền tảng */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              accent
              icon={<Coins className="size-5" aria-hidden />}
              label="Doanh thu thuê bao"
              value={formatCompactPrice(overview?.platformRevenue.totalCollected ?? 0)}
              hint={`${overview?.platformRevenue.paidInvoices ?? 0} hoá đơn đã thu`}
            />
            <StatCard
              icon={<TrendingUp className="size-5" aria-hidden />}
              label="Thu tháng này"
              value={formatCompactPrice(overview?.platformRevenue.collectedThisMonth ?? 0)}
              hint="So với tháng trước"
              delta={delta}
            />
            <StatCard
              icon={<CalendarRange className="size-5" aria-hidden />}
              label="MRR"
              value={formatCompactPrice(overview?.platformRevenue.mrr ?? 0)}
              hint="Tổng giá gói của các thuê bao đang hiệu lực"
            />
            <StatCard
              icon={<ReceiptText className="size-5" aria-hidden />}
              label="Chờ đối soát"
              value={String(overview?.platformRevenue.awaitingConfirmationCount ?? 0)}
              hint={`${formatCompactPrice(overview?.platformRevenue.awaitingConfirmationAmount ?? 0)} chủ sân báo đã chuyển`}
            />
          </>
        )}
      </div>

      {/* Việc cần xử lý */}
      {!isPending && overview && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionCard
            icon={<ClipboardCheck className="size-5 text-primary" aria-hidden />}
            title="Sân chờ duyệt"
            count={overview.fields.pendingApproval}
            emptyText="Không có sân nào đang chờ duyệt."
            href="/admin/fields"
            cta="Mở hàng chờ duyệt"
          />
          <ActionCard
            icon={<ReceiptText className="size-5 text-primary" aria-hidden />}
            title="Hoá đơn chờ đối soát"
            count={overview.platformRevenue.awaitingConfirmationCount}
            emptyText="Không có hoá đơn nào chờ xác nhận."
            href="/admin/invoices?status=awaiting_confirmation"
            cta="Đối soát hoá đơn"
          />
        </div>
      )}

      {/* Quy mô nền tảng */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              icon={<Users className="size-5" aria-hidden />}
              label="Người dùng"
              value={String(overview?.users.total ?? 0)}
              hint={`+${overview?.users.newThisMonth ?? 0} tháng này · ${overview?.users.banned ?? 0} bị cấm`}
            />
            <StatCard
              icon={<BadgeCheck className="size-5" aria-hidden />}
              label="Chủ sân"
              value={String(overview?.users.owners ?? 0)}
              hint={`${overview?.users.managers ?? 0} quản lý đội`}
            />
            <StatCard
              icon={<Volleyball className="size-5" aria-hidden />}
              label="Sân bóng"
              value={String(overview?.fields.total ?? 0)}
              hint={`${overview?.fields.active ?? 0} đang hoạt động · ${overview?.fields.pendingApproval ?? 0} chờ duyệt`}
            />
            <StatCard
              icon={<CalendarRange className="size-5" aria-hidden />}
              label="Lượt đặt sân"
              value={String(overview?.bookings.total ?? 0)}
              hint={`${overview?.bookings.thisMonth ?? 0} lượt tháng này · GMV ${formatCompactPrice(
                overview?.bookings.grossMerchandiseValue ?? 0
              )}`}
            />
          </>
        )}
      </div>

      {/* Biểu đồ doanh thu */}
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" aria-hidden />
              Doanh thu nền tảng theo tháng
            </CardTitle>
            <CardDescription>Chỉ tính hoá đơn thuê bao đã thanh toán</CardDescription>
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
        </CardHeader>
        <CardContent>
          {seriesPending ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <MonthlyBarChart
              data={series.map((p) => ({
                label: p.label,
                value: p.platformRevenue,
                secondary: `${p.paidInvoices} hoá đơn · ${p.newUsers} người dùng mới`,
              }))}
              format={formatCompactPrice}
              seriesLabel="Doanh thu nền tảng"
            />
          )}
        </CardContent>
      </Card>

      {/* Phân bổ gói */}
      <Card>
        <CardHeader>
          <CardTitle>Phân bổ gói thuê bao</CardTitle>
          <CardDescription>Số chủ sân đang dùng từng gói</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isPending ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 font-medium">Gói</th>
                  <th scope="col" className="py-2 text-right font-medium">Giá/tháng</th>
                  <th scope="col" className="py-2 text-right font-medium">Đang hiệu lực</th>
                  <th scope="col" className="py-2 text-right font-medium">Tổng đăng ký</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.planDistribution ?? []).map((p) => (
                  <tr key={p.code} className="border-b last:border-0">
                    <th scope="row" className="py-2 text-left font-normal">{p.name}</th>
                    <td className="py-2 text-right">{formatPrice(p.monthlyPrice)}</td>
                    <td className="py-2 text-right font-medium">{p.active}</td>
                    <td className="py-2 text-right text-muted-foreground">{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  count,
  emptyText,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  emptyText: string;
  href: string;
  cta: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">
              {count > 0 ? `${count} mục đang chờ bạn` : emptyText}
            </p>
          </div>
        </div>
        <Button
          variant={count > 0 ? 'default' : 'outline'}
          size="sm"
          nativeButton={false}
          render={<Link href={href} />}
        >
          {cta}
        </Button>
      </CardContent>
    </Card>
  );
}
