'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Ban, Mail, Search, ShieldCheck, UserCheck, Users } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import adminService from '@/services/admin.service';
import {
  ROLE_COLORS,
  ROLE_LABELS,
  USER_STATUS_COLORS,
  USER_STATUS_LABELS,
} from '@/lib/constants';
import { formatDate, initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import useAuthStore from '@/stores/authStore';
import type { ApiResponse, Role, User } from '@/types';

const ALL = 'all';
const PAGE_SIZE = 10;
const ROLES: Role[] = ['user', 'team_manager', 'field_owner', 'admin'];
const STATUSES: User['status'][] = ['active', 'inactive', 'banned'];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [role, setRole] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | null>(null);
  const [draftRoles, setDraftRoles] = useState<Role[]>([]);

  const filters = {
    page,
    limit: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(role !== ALL ? { role: role as Role } : {}),
    ...(status !== ALL ? { status: status as User['status'] } : {}),
  };

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () => adminService.getUsers(filters),
  });
  const users = data?.data?.data?.users ?? [];
  const pagination = data?.data?.meta?.pagination;

  const onError = (err: AxiosError<ApiResponse<null>>) =>
    toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  const updateStatus = useMutation({
    mutationFn: ({ id, status: next }: { id: string; status: User['status'] }) =>
      adminService.updateUser(id, { status: next }),
    onSuccess: (_res, vars) => {
      toast.success(vars.status === 'banned' ? 'Đã cấm tài khoản.' : 'Đã cập nhật trạng thái tài khoản.');
      invalidate();
    },
    onError,
  });

  const updateRoles = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: Role[] }) => adminService.updateUser(id, { roles }),
    onSuccess: () => {
      toast.success('Đã cập nhật vai trò.');
      setEditing(null);
      invalidate();
    },
    onError,
  });

  const busy = updateStatus.isPending || updateRoles.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Người dùng</h1>
        <p className="text-muted-foreground">Cấp vai trò và khoá tài khoản vi phạm</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_12rem]"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="user-search">Tìm người dùng</Label>
              <div className="flex gap-2">
                <Input
                  id="user-search"
                  placeholder="Tên, username hoặc email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <Button type="submit" variant="outline">
                  <Search className="size-4" aria-hidden />
                  Tìm
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-role">Vai trò</Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  if (v) {
                    setRole(v);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả vai trò</SelectItem>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-status">Trạng thái</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  if (v) {
                    setStatus(v);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger id="user-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả trạng thái</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {USER_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold">Không có người dùng nào</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Không tìm thấy người dùng khớp với bộ lọc hiện tại.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className={cn('space-y-3', isFetching && 'opacity-60 transition-opacity')}>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <li key={u.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-11">
                        <AvatarImage src={u.avatar} alt={u.fullName} />
                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                          {initialsOf(u.fullName || u.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.fullName || u.username}
                          {isSelf && <span className="ml-2 text-xs text-muted-foreground">(bạn)</span>}
                        </p>
                        <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                          <Mail className="size-3.5 shrink-0" aria-hidden />
                          {u.email}
                        </p>
                        <p className="text-xs text-muted-foreground">Tham gia {formatDate(u.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="outline" className={cn('border-0', ROLE_COLORS[r])}>
                          {ROLE_LABELS[r] ?? r}
                        </Badge>
                      ))}
                      <Badge variant="outline" className={cn('border-0', USER_STATUS_COLORS[u.status])}>
                        {USER_STATUS_LABELS[u.status] ?? u.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || isSelf}
                        title={isSelf ? 'Không tự đổi vai trò của chính mình' : undefined}
                        onClick={() => {
                          setEditing(u);
                          setDraftRoles(u.roles);
                        }}
                      >
                        <ShieldCheck className="size-4" aria-hidden />
                        Vai trò
                      </Button>
                      {u.status === 'banned' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => updateStatus.mutate({ id: u.id, status: 'active' })}
                        >
                          <UserCheck className="size-4" aria-hidden />
                          Bỏ cấm
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy || isSelf}
                          title={isSelf ? 'Không tự cấm chính mình' : undefined}
                          onClick={() => updateStatus.mutate({ id: u.id, status: 'banned' })}
                        >
                          <Ban className="size-4" aria-hidden />
                          Cấm
                        </Button>
                      )}
                    </div>
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
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} người dùng
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

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vai trò của {editing?.fullName || editing?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Mỗi tài khoản phải giữ ít nhất một vai trò. Cấp vai trò chủ sân sẽ mở khu quản lý sân cho họ.
            </p>
            {ROLES.map((r) => (
              <div key={r} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <Label htmlFor={`role-${r}`} className="cursor-pointer">
                  {ROLE_LABELS[r]}
                </Label>
                <Switch
                  id={`role-${r}`}
                  checked={draftRoles.includes(r)}
                  onCheckedChange={(checked) =>
                    setDraftRoles((prev) => (checked ? [...prev, r] : prev.filter((x) => x !== r)))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Quay lại
            </Button>
            <Button
              disabled={draftRoles.length === 0 || updateRoles.isPending}
              onClick={() => editing && updateRoles.mutate({ id: editing.id, roles: draftRoles })}
            >
              {updateRoles.isPending ? 'Đang lưu...' : 'Lưu vai trò'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
