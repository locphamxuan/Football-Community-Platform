'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import teamService from '@/services/team.service';
import { SKILL_LEVEL_LABELS, SKILL_LEVEL_COLORS } from '@/lib/constants';
import useAuthStore from '@/stores/authStore';
import type { Team, TeamMember } from '@/types';
import { toast } from 'sonner';
import { Trophy, Users, MapPin, Shield, UserMinus, Copy, RefreshCw } from 'lucide-react';

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['team', id],
    queryFn: () => teamService.getTeamById(id),
  });

  const team: Team | undefined = data?.data?.data?.team;

  const managerId = (team?.manager as unknown as { _id?: string; id?: string })?._id ?? team?.manager?.id;
  const isManager = managerId === user?.id;
  const isMember = team?.members?.some((m) => {
    const uid = (m.user as unknown as { _id?: string; id?: string })?._id ?? m.user?.id;
    return uid === user?.id;
  });

  const joinMutation = useMutation({
    mutationFn: () => teamService.joinTeam(id, inviteCode),
    onSuccess: () => {
      toast.success('Tham gia đội thành công!');
      setJoinDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['team', id] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Mã mời không hợp lệ';
      toast.error(msg);
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => teamService.leaveTeam(id),
    onSuccess: () => { toast.success('Rời đội thành công'); qc.invalidateQueries({ queryKey: ['team', id] }); },
    onError: () => toast.error('Có lỗi xảy ra'),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => teamService.removeMember(id, memberId),
    onSuccess: () => { toast.success('Đã xóa thành viên'); qc.invalidateQueries({ queryKey: ['team', id] }); },
    onError: () => toast.error('Có lỗi xảy ra'),
  });

  const regenCodeMutation = useMutation({
    mutationFn: () => teamService.regenerateInviteCode(id),
    onSuccess: () => { toast.success('Đã tạo mã mới'); qc.invalidateQueries({ queryKey: ['team', id] }); },
  });

  if (isLoading) return <TeamDetailSkeleton />;
  if (!team) return <div className="container mx-auto px-4 py-16 text-center">Không tìm thấy đội bóng</div>;

  const { wins, draws, losses, matchesPlayed, eloRating, goalsScored, goalsConceded } = team.stats;
  const activeMembers = team.members.filter((m) => m.status === 'active');

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
        <Avatar className="h-24 w-24 border-4 border-primary/20">
          <AvatarImage src={team.logo} alt={team.name} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl">
            {team.name.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            {team.status === 'active' && <Badge className="bg-primary/10 text-primary">Đang hoạt động</Badge>}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="outline" className={SKILL_LEVEL_COLORS[team.skillLevel]}>
              {SKILL_LEVEL_LABELS[team.skillLevel]}
            </Badge>
            <Badge variant="outline">{team.fieldSize}</Badge>
            {team.homeCity && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />{team.homeCity}
              </span>
            )}
          </div>

          {team.description && <p className="text-muted-foreground text-sm max-w-xl">{team.description}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {isAuthenticated && !isMember && team.status === 'active' && (
            <Button variant="outline" onClick={() => setJoinDialogOpen(true)}>
              <Shield className="h-4 w-4 mr-2" />Tham gia
            </Button>
          )}
          {isAuthenticated && isMember && !isManager && (
            <Button variant="outline" className="text-red-600 border-red-200" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}>
              Rời đội
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />Thống kê</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">ELO Rating</span>
              <span className="font-bold text-amber-600">{eloRating}</span>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-bold text-primary">{wins}</div>
                <div className="text-xs text-muted-foreground">Thắng</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-500">{draws}</div>
                <div className="text-xs text-muted-foreground">Hòa</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-500">{losses}</div>
                <div className="text-xs text-muted-foreground">Thua</div>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bàn thắng</span>
              <span className="font-medium">{goalsScored} - {goalsConceded}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tổng trận</span>
              <span className="font-medium">{matchesPlayed}</span>
            </div>
          </CardContent>
        </Card>

        {/* Members */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />Thành viên ({activeMembers.length}/{team.maxMembers})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {activeMembers.map((member) => (
                <MemberRow
                  key={member.user?.id ?? (member.user as unknown as { _id: string })?._id}
                  member={member}
                  isManager={isManager}
                  currentUserId={user?.id ?? ''}
                  onRemove={(uid) => removeMutation.mutate(uid)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite code (manager only) */}
      {isManager && team.inviteCode && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Mã mời tham gia</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded bg-muted px-4 py-2 font-mono text-lg tracking-widest text-center">
                {team.inviteCode}
              </code>
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(team.inviteCode ?? ''); toast.success('Đã sao chép!'); }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => regenCodeMutation.mutate()} disabled={regenCodeMutation.isPending}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Chia sẻ mã này để mời thành viên tham gia đội.</p>
          </CardContent>
        </Card>
      )}

      {/* Join dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tham gia đội {team.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Mã mời</Label>
            <Input
              placeholder="Nhập mã mời (VD: AB12CD34)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="font-mono text-center tracking-widest text-lg"
              maxLength={8}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>Hủy</Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              disabled={inviteCode.length < 4 || joinMutation.isPending}
              onClick={() => joinMutation.mutate()}
            >
              {joinMutation.isPending ? 'Đang tham gia...' : 'Tham gia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberRow({
  member, isManager, currentUserId, onRemove,
}: {
  member: TeamMember;
  isManager: boolean;
  currentUserId: string;
  onRemove: (uid: string) => void;
}) {
  const uid = member.user?.id ?? (member.user as unknown as { _id: string })?._id ?? '';
  const roleBadge = member.role === 'manager' ? 'bg-primary/10 text-primary' : member.role === 'captain' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600';
  const roleLabel = member.role === 'manager' ? 'Quản lý' : member.role === 'captain' ? 'Đội trưởng' : 'Cầu thủ';

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
      <Avatar className="h-9 w-9">
        <AvatarImage src={member.user?.avatar} />
        <AvatarFallback>{member.user?.fullName?.charAt(0) ?? '?'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{member.user?.fullName}</p>
        <p className="text-xs text-muted-foreground">@{member.user?.username}</p>
      </div>
      <Badge className={`text-xs ${roleBadge}`}>{roleLabel}</Badge>
      {isManager && uid !== currentUserId && member.role !== 'manager' && (
        <Button
          variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={() => onRemove(uid)}
        >
          <UserMinus className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function TeamDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex gap-6 mb-8">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-52" />
        <Skeleton className="h-52 lg:col-span-2" />
      </div>
    </div>
  );
}
