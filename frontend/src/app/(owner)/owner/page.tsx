'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck, CalendarClock, Clock, MessageSquareText, Plus, Star, TrendingUp, Volleyball, Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import MonthlyBarChart from '@/components/dashboard/MonthlyBarChart';
import StatCard from '@/components/dashboard/StatCard';
import StarRating from '@/components/reviews/StarRating';
import bookingService from '@/services/booking.service';
import reviewService from '@/services/review.service';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/lib/constants';
import { formatCompactPrice, formatDate, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

const REVENUE_TREND_MONTHS = 6;
const RECENT_REVIEWS_LIMIT = 3;

export default function OwnerOverviewPage() {
  const { data: statsRes, isPending: statsLoading } = useQuery({
    queryKey: ['owner-stats'],
    queryFn: () => bookingService.getOwnerStats(),
  });
  const stats = statsRes?.data?.data?.stats;

  const { data: pendingRes, isPending: pendingLoading } = useQuery({
    queryKey: ['owner-bookings', { status: 'pending', limit: 5 }],
    queryFn: () => bookingService.getOwnerBookings({ status: 'pending', limit: 5 }),
  });
  const pending = pendingRes?.data?.data?.bookings ?? [];

  const { data: revenueRes, isPending: revenueLoading } = useQuery({
    queryKey: ['owner-revenue', REVENUE_TREND_MONTHS],
    queryFn: () => bookingService.getOwnerRevenue(REVENUE_TREND_MONTHS),
  });
  const revenueSeries = revenueRes?.data?.data?.series ?? [];

  const { data: reviewsRes, isPending: reviewsLoading } = useQuery({
    queryKey: ['owner-reviews', { limit: RECENT_REVIEWS_LIMIT }],
    queryFn: () => reviewService.getOwnerReviews({ limit: RECENT_REVIEWS_LIMIT }),
  });
  const recentReviews = reviewsRes?.data?.data?.reviews ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">Tổng quan</h1>
          <p className="text-muted-foreground">Tình hình sân và lịch đặt của bạn</p>
        </div>
        <Button nativeButton={false} render={<Link href="/owner/fields/new" />}>
          <Plus className="size-4" aria-hidden />
          Thêm sân mới
        </Button>
      </div>

      {/* Thẻ số liệu */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading || !stats ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              icon={<Clock className="size-5" aria-hidden />}
              label="Chờ xác nhận"
              value={String(stats.pendingBookings)}
              hint={stats.pendingBookings > 0 ? 'Cần bạn xử lý' : 'Không còn yêu cầu nào'}
              accent={stats.pendingBookings > 0}
            />
            <StatCard
              icon={<CalendarClock className="size-5" aria-hidden />}
              label="Lịch hôm nay"
              value={String(stats.todayBookings)}
              hint="Đang chờ hoặc đã xác nhận"
            />
            <StatCard
              icon={<Wallet className="size-5" aria-hidden />}
              label="Doanh thu tháng này"
              value={formatCompactPrice(stats.monthRevenue)}
              hint={`Từ ${stats.completedBookings} lượt đã hoàn thành`}
            />
            <StatCard
              icon={<Volleyball className="size-5" aria-hidden />}
              label="Sân đang hoạt động"
              value={`${stats.activeFields}/${stats.totalFields}`}
              hint={
                stats.averageRating > 0
                  ? `Đánh giá trung bình ${stats.averageRating.toFixed(1)}/5`
                  : 'Chưa có đánh giá'
              }
            />
          </>
        )}
      </div>

      {/* Yêu cầu đặt sân chờ xác nhận */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-primary" aria-hidden />
            Yêu cầu chờ xác nhận
          </CardTitle>
          <CardDescription>Xác nhận sớm để khách giữ được sân</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/owner/bookings" />}>
              Xem tất cả
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Không có yêu cầu nào đang chờ xác nhận.
            </p>
          ) : (
            <ul className="divide-y">
              {pending.map((b) => (
                <li key={b._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {b.user?.fullName || b.user?.username}
                      {b.team ? ` · ${b.team.name}` : ''}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {b.field?.name} · {b.subFieldName} · {formatDate(b.date)} · {b.startTime}–{b.endTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-primary">{formatPrice(b.totalPrice)}</span>
                    <Badge variant="outline" className={cn('border-0', BOOKING_STATUS_COLORS[b.status])}>
                      {BOOKING_STATUS_LABELS[b.status]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Xu hướng doanh thu */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" aria-hidden />
              Xu hướng doanh thu
            </CardTitle>
            <CardDescription>{REVENUE_TREND_MONTHS} tháng gần nhất</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/owner/revenue" />}>
                Xem chi tiết
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-52 rounded-xl" />
            ) : (
              <MonthlyBarChart
                data={revenueSeries.map((p) => ({
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

        {/* Đánh giá gần đây */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="size-5 text-primary" aria-hidden />
              Đánh giá gần đây
            </CardTitle>
            <CardDescription>
              {stats && stats.averageRating > 0
                ? `Trung bình ${stats.averageRating.toFixed(1)}/5`
                : 'Chưa có đánh giá'}
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/owner/reviews" />}>
                Xem tất cả
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {reviewsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : recentReviews.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Chưa có đánh giá nào.</p>
            ) : (
              <ul className="divide-y">
                {recentReviews.map((r) => (
                  <li key={r._id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate font-medium">{r.user.fullName || r.user.username}</p>
                      <StarRating value={r.rating} />
                    </div>
                    {r.comment && <p className="line-clamp-2 text-sm text-muted-foreground">{r.comment}</p>}
                    {!r.ownerReply?.repliedAt && (
                      <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <MessageSquareText className="size-3.5" aria-hidden />
                        Chưa phản hồi
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
