'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { CheckCircle2, Clock, MapPin, Swords, Trophy, XCircle } from 'lucide-react';
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
import matchRequestService from '@/services/matchRequest.service';
import teamService from '@/services/team.service';
import { MATCH_REQUEST_STATUS_COLORS, MATCH_REQUEST_STATUS_LABELS } from '@/lib/constants';
import { formatDate, initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ApiResponse, MatchRequest } from '@/types';

const STATUS_TABS = [
  { value: 'pending', label: 'Chờ phản hồi' },
  { value: 'accepted', label: 'Đã chốt' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: '', label: 'Tất cả' },
];

const ALL_TEAMS = 'all';
const PAGE_SIZE = 10;

/** Trận đã tới giờ bóng lăn mới nhập được tỉ số — backend cũng chặn tương tự. */
const hasKickedOff = (r: MatchRequest) =>
  new Date(`${r.date.slice(0, 10)}T${r.startTime}:00`) <= new Date();

function ManagerMatchesContent() {
  const qc = useQueryClient();
  const initialStatus = useSearchParams().get('status') ?? 'pending';

  const [status, setStatus] = useState(initialStatus);
  const [teamId, setTeamId] = useState(ALL_TEAMS);
  const [page, setPage] = useState(1);
  const [scoring, setScoring] = useState<MatchRequest | null>(null);
  const [scores, setScores] = useState({ requesterScore: 0, opponentScore: 0 });

  const { data: dashboardRes } = useQuery({
    queryKey: ['manager-dashboard'],
    queryFn: () => teamService.getManagerDashboard(),
  });
  const myTeams = dashboardRes?.data?.data?.teams ?? [];
  const myTeamIds = new Set(myTeams.map((t) => t._id));

  const filters = {
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(teamId !== ALL_TEAMS ? { teamId } : {}),
  };

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['manager-matches', filters],
    queryFn: () => matchRequestService.getAll(filters),
  });
  const requests = data?.data?.data?.requests ?? [];
  const pagination = data?.data?.meta?.pagination;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['manager-matches'] });
    qc.invalidateQueries({ queryKey: ['manager-dashboard'] });
  };

  const onError = (err: AxiosError<ApiResponse<null>>) =>
    toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra');

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => matchRequestService.respond(id, accept),
    onSuccess: (_res, vars) => {
      toast.success(vars.accept ? 'Đã nhận lời thách đấu.' : 'Đã từ chối lời thách đấu.');
      invalidate();
    },
    onError,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => matchRequestService.cancel(id),
    onSuccess: () => {
      toast.success('Đã huỷ lời thách đấu.');
      invalidate();
    },
    onError,
  });

  const submitResult = useMutation({
    mutationFn: ({ id, data: payload }: { id: string; data: typeof scores }) =>
      matchRequestService.submitResult(id, payload),
    onSuccess: () => {
      toast.success('Đã ghi nhận tỉ số. Trận hoàn tất khi cả hai đội cùng xác nhận.');
      setScoring(null);
      invalidate();
    },
    onError,
  });

  const busy = respond.isPending || cancel.isPending || submitResult.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Lời mời thi đấu</h1>
        <p className="text-muted-foreground">
          Trả lời lời mời đến, theo dõi lời mời đã gửi và nhập kết quả sau trận
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <Tabs
            value={status}
            onValueChange={(v) => {
              setStatus(v ?? '');
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

          <div className="w-full space-y-1 sm:max-w-xs">
            <Label htmlFor="team-filter">Đội</Label>
            <Select
              value={teamId}
              onValueChange={(v) => {
                if (v) {
                  setTeamId(v);
                  setPage(1);
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
        </CardContent>
      </Card>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Swords className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold">Không có lời mời nào</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Không tìm thấy lời mời khớp với bộ lọc hiện tại.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className={cn('space-y-3', isFetching && 'opacity-60 transition-opacity')}>
          {requests.map((r) => {
            // Đội mình là bên nhận → mình là người phải trả lời
            const isIncoming = myTeamIds.has(r.opponentTeam?._id);
            const canRespond = r.status === 'pending' && isIncoming;
            const canCancel = r.status === 'pending' && !isIncoming;
            const canScore = r.status === 'accepted' && hasKickedOff(r);

            return (
              <li key={r._id}>
                <Card>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <TeamChip name={r.requesterTeam?.name} logo={r.requesterTeam?.logo} />
                        <span className="text-sm text-muted-foreground">vs</span>
                        <TeamChip name={r.opponentTeam?.name} logo={r.opponentTeam?.logo} />
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant="outline">{isIncoming ? 'Được mời' : 'Đã gửi đi'}</Badge>
                        <Badge variant="outline" className={cn('border-0', MATCH_REQUEST_STATUS_COLORS[r.status])}>
                          {MATCH_REQUEST_STATUS_LABELS[r.status] ?? r.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="size-4 shrink-0" aria-hidden />
                        {formatDate(r.date)} · {r.startTime}–{r.endTime} · {r.fieldSize}
                      </p>
                      {r.field && (
                        <p className="flex items-center gap-1.5 truncate text-muted-foreground">
                          <MapPin className="size-4 shrink-0" aria-hidden />
                          {r.field.name}
                        </p>
                      )}
                    </div>

                    {r.message && (
                      <p className="rounded-lg bg-muted/50 p-3 text-sm">
                        <span className="font-medium">Lời nhắn: </span>
                        {r.message}
                      </p>
                    )}

                    {r.result && (r.result.confirmedByRequester || r.result.confirmedByOpponent) && (
                      <div className="rounded-lg border p-3 text-sm">
                        <p className="flex items-center gap-2 font-medium">
                          <Trophy className="size-4 text-amber-500" aria-hidden />
                          {r.result.requesterScore} – {r.result.opponentScore}
                        </p>
                        <p className="text-muted-foreground">
                          {r.status === 'completed'
                            ? `Đã hoàn tất · Elo ${r.eloChange ? `${r.eloChange.requester > 0 ? '+' : ''}${r.eloChange.requester}/${r.eloChange.opponent > 0 ? '+' : ''}${r.eloChange.opponent}` : 'chưa tính'}`
                            : 'Đang chờ đội còn lại xác nhận tỉ số'}
                        </p>
                      </div>
                    )}

                    {(canRespond || canCancel || canScore) && (
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {canRespond && (
                          <>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => respond.mutate({ id: r._id, accept: true })}
                            >
                              <CheckCircle2 className="size-4" aria-hidden />
                              Nhận lời
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => respond.mutate({ id: r._id, accept: false })}
                            >
                              <XCircle className="size-4" aria-hidden />
                              Từ chối
                            </Button>
                          </>
                        )}
                        {canCancel && (
                          <Button variant="destructive" size="sm" disabled={busy} onClick={() => cancel.mutate(r._id)}>
                            <XCircle className="size-4" aria-hidden />
                            Huỷ lời mời
                          </Button>
                        )}
                        {canScore && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setScoring(r);
                              setScores({
                                requesterScore: r.result?.requesterScore ?? 0,
                                opponentScore: r.result?.opponentScore ?? 0,
                              });
                            }}
                          >
                            <Trophy className="size-4" aria-hidden />
                            Nhập kết quả
                          </Button>
                        )}
                      </div>
                    )}

                    {r.status === 'accepted' && !hasKickedOff(r) && (
                      <p className="text-xs text-muted-foreground">Nhập được kết quả sau khi trận bắt đầu.</p>
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
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} lời mời
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

      <Dialog open={scoring !== null} onOpenChange={(open) => !open && setScoring(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập kết quả trận đấu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Trận chỉ hoàn tất và tính Elo khi cả hai đội cùng nhập tỉ số.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="requester-score">{scoring?.requesterTeam?.name}</Label>
                <Input
                  id="requester-score"
                  type="number"
                  min={0}
                  max={99}
                  value={scores.requesterScore}
                  onChange={(e) => setScores((s) => ({ ...s, requesterScore: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="opponent-score">{scoring?.opponentTeam?.name}</Label>
                <Input
                  id="opponent-score"
                  type="number"
                  min={0}
                  max={99}
                  value={scores.opponentScore}
                  onChange={(e) => setScores((s) => ({ ...s, opponentScore: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoring(null)}>
              Quay lại
            </Button>
            <Button
              disabled={submitResult.isPending}
              onClick={() => scoring && submitResult.mutate({ id: scoring._id, data: scores })}
            >
              {submitResult.isPending ? 'Đang gửi...' : 'Gửi kết quả'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamChip({ name, logo }: { name?: string; logo?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-8">
        <AvatarImage src={logo} alt={name} />
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {initialsOf(name ?? '?')}
        </AvatarFallback>
      </Avatar>
      <span className="truncate font-medium">{name ?? 'Đội đã giải thể'}</span>
    </span>
  );
}

export default function ManagerMatchesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <ManagerMatchesContent />
    </Suspense>
  );
}
