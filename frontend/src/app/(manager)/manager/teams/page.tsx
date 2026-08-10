'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { MapPin, Trophy, UserCog, Users } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import teamService from '@/services/team.service';
import { SKILL_LEVEL_COLORS, SKILL_LEVEL_LABELS } from '@/lib/constants';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import useAuthStore from '@/stores/authStore';
import type { ApiResponse, Team, TeamMember } from '@/types';

/** Backend trả về member.user đã populate — id có thể là `id` hoặc `_id` tuỳ transform. */
const memberId = (m: TeamMember) =>
  (m.user as unknown as { _id?: string; id?: string })?._id ?? m.user?.id ?? '';

export default function ManagerTeamsPage() {
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [transferring, setTransferring] = useState<Team | null>(null);
  const [newManagerId, setNewManagerId] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['manager-dashboard'],
    queryFn: () => teamService.getManagerDashboard(),
  });
  const teams = data?.data?.data?.teams ?? [];

  const transfer = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamService.transferManagement(teamId, userId),
    onSuccess: () => {
      toast.success('Đã chuyển quyền quản lý đội.');
      setTransferring(null);
      setNewManagerId('');
      qc.invalidateQueries({ queryKey: ['manager-dashboard'] });
      qc.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: (err: AxiosError<ApiResponse<null>>) =>
      toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra'),
  });

  const candidates = (transferring?.members ?? []).filter(
    (m) => m.status === 'active' && memberId(m) !== currentUserId
  );

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">Đội của tôi</h1>
          <p className="text-muted-foreground">Các đội bạn đang là người quản lý</p>
        </div>
        <Button nativeButton={false} render={<Link href="/teams/create" />}>
          Tạo đội mới
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold">Chưa có đội nào</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Người tạo đội mặc định là quản lý của đội đó.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {teams.map((t) => {
            const activeMembers = t.members.filter((m) => m.status === 'active');
            return (
              <li key={t._id}>
                <Card>
                  <CardContent className="space-y-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-12">
                          <AvatarImage src={t.logo} alt={t.name} />
                          <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                            {initialsOf(t.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link href={`/teams/${t._id}`} className="font-medium hover:text-primary">
                            {t.name}
                          </Link>
                          <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0" aria-hidden />
                            {t.homeDistrict}, {t.homeCity}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant="outline">{t.fieldSize}</Badge>
                        <Badge variant="outline" className={cn('border-0', SKILL_LEVEL_COLORS[t.skillLevel])}>
                          {SKILL_LEVEL_LABELS[t.skillLevel] ?? t.skillLevel}
                        </Badge>
                      </div>
                    </div>

                    <dl className="grid gap-2 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-xs text-muted-foreground">Thành viên</dt>
                        <dd className="font-medium">
                          {activeMembers.length}/{t.maxMembers}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Thành tích</dt>
                        <dd className="font-medium">
                          {t.stats.wins}T {t.stats.draws}H {t.stats.losses}B
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Bàn thắng/thua</dt>
                        <dd className="font-medium">
                          {t.stats.goalsScored}/{t.stats.goalsConceded}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Elo</dt>
                        <dd className="flex items-center gap-1 font-medium">
                          <Trophy className="size-3.5 text-amber-500" aria-hidden />
                          {t.stats.eloRating}
                        </dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/teams/${t._id}`} />}>
                        <Users className="size-4" aria-hidden />
                        Trang đội
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTransferring(t);
                          setNewManagerId('');
                        }}
                      >
                        <UserCog className="size-4" aria-hidden />
                        Chuyển quyền quản lý
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={transferring !== null} onOpenChange={(open) => !open && setTransferring(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chuyển quyền quản lý {transferring?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Sau khi chuyển, bạn trở thành thành viên thường và không còn quản lý đội này được nữa.
            </p>
            {candidates.length === 0 ? (
              <p className="rounded-lg bg-muted/50 p-3 text-sm">
                Đội chưa có thành viên nào khác đang hoạt động để nhận quyền quản lý.
              </p>
            ) : (
              <>
                <Label htmlFor="new-manager">Người nhận quyền</Label>
                <Select value={newManagerId} onValueChange={(v) => v && setNewManagerId(v)}>
                  <SelectTrigger id="new-manager">
                    <SelectValue placeholder="Chọn thành viên" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((m) => (
                      <SelectItem key={memberId(m)} value={memberId(m)}>
                        {m.user?.fullName || m.user?.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferring(null)}>
              Quay lại
            </Button>
            <Button
              disabled={!newManagerId || transfer.isPending}
              onClick={() =>
                transferring && transfer.mutate({ teamId: transferring._id, userId: newManagerId })
              }
            >
              {transfer.isPending ? 'Đang chuyển...' : 'Chuyển quyền'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
