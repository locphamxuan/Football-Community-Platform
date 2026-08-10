'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  Inbox,
  MapPin,
  Send,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import StatCard from '@/components/dashboard/StatCard';
import teamService from '@/services/team.service';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/lib/constants';
import { formatDate, formatPrice, initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ManagerOverviewPage() {
  const { data, isPending } = useQuery({
    queryKey: ['manager-dashboard'],
    queryFn: () => teamService.getManagerDashboard(),
  });
  const dashboard = data?.data?.data;
  const totals = dashboard?.totals;

  if (!isPending && totals?.totalTeams === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <Users className="size-10 text-muted-foreground" aria-hidden />
          <h1 className="font-heading text-xl font-bold">Bạn chưa dẫn dắt đội nào</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Tạo một đội để mở khu quản lý: theo dõi thành viên, nhận lời mời thi đấu và đặt sân cho cả đội.
          </p>
          <Button nativeButton={false} render={<Link href="/teams/create" />}>
            Tạo đội mới
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Tổng quan đội bóng</h1>
        <p className="text-muted-foreground">Số liệu gộp của tất cả đội bạn đang dẫn dắt</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              icon={<Users className="size-5" aria-hidden />}
              label="Đội dẫn dắt"
              value={String(totals?.totalTeams ?? 0)}
              hint={`${totals?.totalMembers ?? 0} thành viên đang hoạt động`}
            />
            <StatCard
              icon={<Trophy className="size-5" aria-hidden />}
              label="Tỉ lệ thắng"
              value={`${totals?.winRate ?? 0}%`}
              hint={`${totals?.wins ?? 0}T ${totals?.draws ?? 0}H ${totals?.losses ?? 0}B trên ${
                totals?.matchesPlayed ?? 0
              } trận`}
            />
            <StatCard
              icon={<Swords className="size-5" aria-hidden />}
              label="Elo trung bình"
              value={String(totals?.averageElo ?? 0)}
              hint="Trung bình các đội bạn quản lý"
            />
            <StatCard
              accent={(dashboard?.pendingIncoming ?? 0) > 0}
              icon={<Inbox className="size-5" aria-hidden />}
              label="Lời mời chờ trả lời"
              value={String(dashboard?.pendingIncoming ?? 0)}
              hint={`${dashboard?.pendingOutgoing ?? 0} lời mời bạn đã gửi đi`}
            />
          </>
        )}
      </div>

      {!isPending && (dashboard?.awaitingResult ?? 0) > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium">{dashboard?.awaitingResult} trận đã đá chưa nhập kết quả</p>
              <p className="text-sm text-muted-foreground">
                Nhập tỉ số để hệ thống cập nhật Elo và thành tích cho đội.
              </p>
            </div>
            <Button size="sm" nativeButton={false} render={<Link href="/manager/matches?status=accepted" />}>
              Nhập kết quả
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Trận sắp tới */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="size-5 text-primary" aria-hidden />
              Trận sắp tới
            </CardTitle>
            <CardDescription>Các lời mời đã được hai bên chốt</CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : (dashboard?.upcomingMatches.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Chưa có trận nào được chốt.</p>
            ) : (
              <ul className="space-y-3">
                {dashboard?.upcomingMatches.map((m) => (
                  <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarImage src={m.opponentTeam?.logo} alt={m.opponentTeam?.name} />
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {initialsOf(m.opponentTeam?.name ?? '?')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {m.requesterTeam?.name} vs {m.opponentTeam?.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(m.date)} · {m.startTime}–{m.endTime} · {m.fieldSize}
                          {m.field ? ` · ${m.field.name}` : ''}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Lịch sân sắp tới */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="size-5 text-primary" aria-hidden />
              Lịch sân sắp tới
            </CardTitle>
            <CardDescription>Sân đã đặt cho đội, chưa diễn ra</CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : (dashboard?.upcomingBookings.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Đội chưa có lịch sân nào sắp tới.</p>
            ) : (
              <ul className="space-y-3">
                {dashboard?.upcomingBookings.map((b) => (
                  <li key={b._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.field?.name}</p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" aria-hidden />
                        {b.field?.location?.district}, {b.field?.location?.city}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(b.date)} · {b.startTime}–{b.endTime} · {formatPrice(b.totalPrice)}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('border-0', BOOKING_STATUS_COLORS[b.status])}>
                      {BOOKING_STATUS_LABELS[b.status] ?? b.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <Send className="size-5 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Tìm đối thủ mới</p>
              <p className="text-sm text-muted-foreground">Gửi lời mời thi đấu tới đội khác trong khu vực.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/teams" />}>
            Duyệt danh sách đội
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
