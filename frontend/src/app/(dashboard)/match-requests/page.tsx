'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import matchRequestService from '@/services/matchRequest.service';
import { MATCH_REQUEST_STATUS_LABELS, MATCH_REQUEST_STATUS_COLORS } from '@/lib/constants';
import type { MatchRequest } from '@/types';
import { toast } from 'sonner';
import { Swords, Calendar, Clock, Trophy, CheckCircle, XCircle } from 'lucide-react';

export default function MatchRequestsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();
  const [resultDialog, setResultDialog] = useState<{ open: boolean; request: MatchRequest | null }>({ open: false, request: null });
  const [scores, setScores] = useState({ requesterScore: 0, opponentScore: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ['match-requests', statusFilter],
    queryFn: () => matchRequestService.getAll({ status: statusFilter || undefined }),
  });

  const requests: MatchRequest[] = data?.data?.data?.requests ?? [];

  const respondMutation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => matchRequestService.respond(id, accept),
    onSuccess: (_, { accept }) => {
      toast.success(accept ? 'Đã chấp nhận lời thách đấu!' : 'Đã từ chối lời thách đấu');
      qc.invalidateQueries({ queryKey: ['match-requests'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => matchRequestService.cancel(id),
    onSuccess: () => { toast.success('Đã hủy lời thách đấu'); qc.invalidateQueries({ queryKey: ['match-requests'] }); },
  });

  const resultMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof scores }) => matchRequestService.submitResult(id, data),
    onSuccess: () => {
      toast.success('Đã ghi nhận kết quả!');
      setResultDialog({ open: false, request: null });
      qc.invalidateQueries({ queryKey: ['match-requests'] });
    },
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lời thách đấu</h1>
        <p className="text-muted-foreground mt-1">Quản lý các lời thách đấu của đội bạn</p>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="">Tất cả</TabsTrigger>
          <TabsTrigger value="pending">Chờ phản hồi</TabsTrigger>
          <TabsTrigger value="accepted">Đã chấp nhận</TabsTrigger>
          <TabsTrigger value="completed">Hoàn thành</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <Swords className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Chưa có lời thách đấu nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req._id}>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Teams */}
                  <div className="flex items-center gap-3 flex-1">
                    <TeamAvatar team={req.requesterTeam} />
                    <div className="text-center px-2">
                      <Swords className="h-5 w-5 text-muted-foreground" />
                      {req.result?.winner && (
                        <div className="text-xs font-bold mt-1">
                          {req.result.requesterScore} - {req.result.opponentScore}
                        </div>
                      )}
                    </div>
                    <TeamAvatar team={req.opponentTeam} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-sm space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(req.date), 'dd/MM/yyyy', { locale: vi })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{req.startTime} – {req.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{req.fieldSize}</Badge>
                      <Badge className={`text-xs ${MATCH_REQUEST_STATUS_COLORS[req.status]}`}>
                        {MATCH_REQUEST_STATUS_LABELS[req.status]}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {req.status === 'pending' && (
                      <>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => respondMutation.mutate({ id: req._id, accept: true })}>
                          <CheckCircle className="h-3 w-3 mr-1" />Chấp nhận
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => respondMutation.mutate({ id: req._id, accept: false })}>
                          <XCircle className="h-3 w-3 mr-1" />Từ chối
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(req._id)}>Hủy</Button>
                      </>
                    )}
                    {req.status === 'accepted' && (
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => { setResultDialog({ open: true, request: req }); setScores({ requesterScore: 0, opponentScore: 0 }); }}>
                        <Trophy className="h-3 w-3 mr-1" />Nhập kết quả
                      </Button>
                    )}
                  </div>
                </div>

                {req.message && (
                  <p className="mt-3 text-sm text-muted-foreground border-t pt-2">"{req.message}"</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Result dialog */}
      <Dialog open={resultDialog.open} onOpenChange={(o) => setResultDialog({ open: o, request: resultDialog.request })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nhập kết quả trận đấu</DialogTitle></DialogHeader>
          {resultDialog.request && (
            <div className="py-4 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <p className="font-medium text-sm mb-2">{resultDialog.request.requesterTeam.name}</p>
                  <Input
                    type="number" min={0} max={99}
                    className="text-center text-2xl font-bold h-16"
                    value={scores.requesterScore}
                    onChange={(e) => setScores((s) => ({ ...s, requesterScore: Number(e.target.value) }))}
                  />
                </div>
                <span className="text-2xl font-bold text-muted-foreground">–</span>
                <div className="flex-1 text-center">
                  <p className="font-medium text-sm mb-2">{resultDialog.request.opponentTeam.name}</p>
                  <Input
                    type="number" min={0} max={99}
                    className="text-center text-2xl font-bold h-16"
                    value={scores.opponentScore}
                    onChange={(e) => setScores((s) => ({ ...s, opponentScore: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Kết quả sẽ được xác nhận khi cả 2 đội đồng ý. ELO sẽ cập nhật sau khi xác nhận xong.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultDialog({ open: false, request: null })}>Hủy</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={resultMutation.isPending}
              onClick={() => resultDialog.request && resultMutation.mutate({ id: resultDialog.request._id, data: scores })}
            >
              {resultMutation.isPending ? 'Đang lưu...' : 'Xác nhận kết quả'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamAvatar({ team }: { team: MatchRequest['requesterTeam'] }) {
  return (
    <div className="flex flex-col items-center gap-1 w-24">
      <Avatar className="h-12 w-12">
        <AvatarImage src={team.logo} alt={team.name} />
        <AvatarFallback className="bg-green-100 text-green-700 font-bold">{team.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <p className="text-xs font-medium text-center line-clamp-2">{team.name}</p>
      <span className="text-xs text-amber-600 font-bold">{team.stats.eloRating} ELO</span>
    </div>
  );
}
