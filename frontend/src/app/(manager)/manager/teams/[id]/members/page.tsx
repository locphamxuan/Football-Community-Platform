'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { ArrowLeft, Copy, Pencil, RefreshCw, UserMinus, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import teamService from '@/services/team.service';
import useAuthStore from '@/stores/authStore';
import type { ApiResponse, Team, TeamMember } from '@/types';

const ROLE_LABELS: Record<TeamMember['role'], string> = {
  manager: 'Quản lý', captain: 'Đội trưởng', player: 'Cầu thủ',
};
const ROLE_BADGE: Record<TeamMember['role'], string> = {
  manager: 'bg-primary/10 text-primary',
  captain: 'bg-blue-100 text-blue-700',
  player: 'bg-gray-100 text-gray-600',
};
const STATUS_LABELS: Record<TeamMember['status'], string> = {
  active: 'Đang hoạt động', inactive: 'Tạm ngưng',
};

const memberId = (m: TeamMember) =>
  (m.user as unknown as { _id?: string; id?: string })?._id ?? m.user?.id ?? '';

interface EditState {
  memberId: string;
  name: string;
  role: 'captain' | 'player';
  position: string;
  status: 'active' | 'inactive';
}

export default function ManagerTeamMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['team', id],
    queryFn: () => teamService.getTeamById(id),
  });
  const team: Team | undefined = data?.data?.data?.team;
  const managerId = (team?.manager as unknown as { _id?: string; id?: string })?._id ?? team?.manager?.id;
  const isManager = Boolean(team && managerId === currentUserId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['team', id] });
    qc.invalidateQueries({ queryKey: ['manager-dashboard'] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: { memberId: string; role: string; position: string; status: string }) =>
      teamService.updateMember(id, data.memberId, {
        role: data.role, position: data.position, status: data.status,
      }),
    onSuccess: () => {
      toast.success('Đã cập nhật thành viên');
      setEditing(null);
      invalidate();
    },
    onError: (err: AxiosError<ApiResponse<null>>) =>
      toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra'),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => teamService.removeMember(id, memberId),
    onSuccess: () => {
      toast.success('Đã xoá thành viên');
      setRemoving(null);
      invalidate();
    },
    onError: (err: AxiosError<ApiResponse<null>>) =>
      toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra'),
  });

  const regenCodeMutation = useMutation({
    mutationFn: () => teamService.regenerateInviteCode(id),
    onSuccess: () => { toast.success('Đã tạo mã mời mới'); invalidate(); },
    onError: () => toast.error('Có lỗi xảy ra'),
  });

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  if (!team) {
    return <div className="py-16 text-center text-muted-foreground">Không tìm thấy đội bóng.</div>;
  }

  if (!isManager) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Chỉ quản lý đội mới xem được trang này.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/manager/teams"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Đội của tôi
        </Link>
        <h1 className="font-heading text-3xl font-bold">Thành viên · {team.name}</h1>
        <p className="text-muted-foreground">Thêm, sửa vai trò/vị trí, hoặc gỡ thành viên khỏi đội</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mã mời tham gia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded bg-muted px-4 py-2 text-center font-mono text-lg tracking-widest">
              {team.inviteCode}
            </code>
            <Button
              variant="outline" size="icon"
              onClick={() => { navigator.clipboard.writeText(team.inviteCode ?? ''); toast.success('Đã sao chép!'); }}
            >
              <Copy className="size-4" aria-hidden />
            </Button>
            <Button
              variant="outline" size="icon"
              onClick={() => regenCodeMutation.mutate()}
              disabled={regenCodeMutation.isPending}
            >
              <RefreshCw className="size-4" aria-hidden />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Chia sẻ mã này để mời người mới — thành viên tự tham gia bằng mã, quản lý không thêm trực tiếp.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" aria-hidden />
            Danh sách thành viên ({team.members.length}/{team.maxMembers})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {team.members.map((m) => {
              const uid = memberId(m);
              const isSelf = uid === currentUserId;
              return (
                <li key={uid} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar className="size-9">
                    <AvatarImage src={m.user?.avatar} />
                    <AvatarFallback>{m.user?.fullName?.charAt(0) ?? '?'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.user?.fullName}
                      {isSelf ? ' (bạn)' : ''}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{m.user?.username}{m.position ? ` · ${m.position}` : ''}
                    </p>
                  </div>
                  <Badge className={`text-xs ${ROLE_BADGE[m.role]}`}>{ROLE_LABELS[m.role]}</Badge>
                  <Badge variant={m.status === 'active' ? 'outline' : 'secondary'} className="text-xs">
                    {STATUS_LABELS[m.status]}
                  </Badge>
                  {m.role !== 'manager' && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost" size="icon" className="size-8"
                        onClick={() => setEditing({
                          memberId: uid,
                          name: m.user?.fullName ?? '',
                          role: m.role as 'captain' | 'player',
                          position: m.position ?? '',
                          status: m.status,
                        })}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-700"
                        onClick={() => setRemoving(m)}
                      >
                        <UserMinus className="size-4" aria-hidden />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa thông tin {editing?.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="member-role">Vai trò</Label>
                <Select
                  value={editing.role}
                  onValueChange={(v) => v && setEditing({ ...editing, role: v as EditState['role'] })}
                >
                  <SelectTrigger id="member-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="captain">Đội trưởng</SelectItem>
                    <SelectItem value="player">Cầu thủ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-position">Vị trí thi đấu</Label>
                <Input
                  id="member-position"
                  placeholder="VD: Tiền đạo, Thủ môn..."
                  value={editing.position}
                  onChange={(e) => setEditing({ ...editing, position: e.target.value })}
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-status">Trạng thái</Label>
                <Select
                  value={editing.status}
                  onValueChange={(v) => v && setEditing({ ...editing, status: v as EditState['status'] })}
                >
                  <SelectTrigger id="member-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Đang hoạt động</SelectItem>
                    <SelectItem value="inactive">Tạm ngưng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Huỷ</Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() => editing && updateMutation.mutate(editing)}
            >
              {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gỡ {removing?.user?.fullName} khỏi đội?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Người này sẽ không còn là thành viên của đội. Họ có thể tham gia lại bằng mã mời.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>Huỷ</Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => removing && removeMutation.mutate(memberId(removing))}
            >
              {removeMutation.isPending ? 'Đang gỡ...' : 'Gỡ thành viên'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
