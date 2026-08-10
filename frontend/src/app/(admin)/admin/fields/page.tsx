'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { BadgeCheck, CheckCircle2, MapPin, Search, Star, Volleyball, XCircle } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import adminService, { type AdminFieldFilters } from '@/services/admin.service';
import fieldService from '@/services/field.service';
import { FIELD_STATUS_COLORS, FIELD_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ApiResponse, Field } from '@/types';

type TabValue = 'pending' | 'verified' | 'unverified' | 'all';

const TABS: { value: TabValue; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'verified', label: 'Đã xác minh' },
  { value: 'unverified', label: 'Chưa xác minh' },
  { value: 'all', label: 'Tất cả' },
];

const TAB_FILTERS: Record<TabValue, Pick<AdminFieldFilters, 'status' | 'verified'>> = {
  pending: { status: 'pending_approval' },
  verified: { verified: 'true' },
  unverified: { verified: 'false' },
  all: {},
};

const PAGE_SIZE = 10;

/** Hàng chờ duyệt populate thêm email chủ sân để admin liên hệ được ngay. */
type ModerationField = Omit<Field, 'owner'> & {
  owner: Field['owner'] & { email?: string };
};

const ownerLabel = ({ owner }: ModerationField) => {
  if (!owner) return 'Chủ sân đã bị gỡ';
  return `${owner.fullName || owner.username}${owner.email ? ` · ${owner.email}` : ''}`;
};

export default function AdminFieldsPage() {
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabValue>('pending');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [moderating, setModerating] = useState<{ field: ModerationField; approve: boolean } | null>(null);
  const [note, setNote] = useState('');

  const filters = { page, limit: PAGE_SIZE, ...TAB_FILTERS[tab], ...(search ? { search } : {}) };

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['admin-fields', filters],
    queryFn: () => adminService.getFields(filters),
  });
  const fields = (data?.data?.data?.fields ?? []) as ModerationField[];
  const pagination = data?.data?.meta?.pagination;

  const moderate = useMutation({
    mutationFn: ({ id, approve, note: reason }: { id: string; approve: boolean; note: string }) =>
      fieldService.verifyField(id, approve, reason || undefined),
    onSuccess: (_res, vars) => {
      toast.success(vars.approve ? 'Đã duyệt và xác minh sân.' : 'Đã từ chối sân.');
      setModerating(null);
      setNote('');
      qc.invalidateQueries({ queryKey: ['admin-fields'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
    onError: (err: AxiosError<ApiResponse<null>>) =>
      toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Duyệt sân</h1>
        <p className="text-muted-foreground">
          Duyệt sân sẽ xác minh và mở bán; từ chối sẽ đưa sân về trạng thái tạm ngưng
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab((v ?? 'pending') as TabValue);
              setPage(1);
            }}
          >
            <TabsList className="flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <form
            className="space-y-1"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <Label htmlFor="field-search">Tìm sân</Label>
            <div className="flex gap-2">
              <Input
                id="field-search"
                placeholder="Tên sân hoặc địa chỉ..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <Button type="submit" variant="outline">
                <Search className="size-4" aria-hidden />
                Tìm
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : fields.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Volleyball className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold">Không có sân nào</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {tab === 'pending'
                ? 'Hàng chờ trống — chưa có sân nào cần duyệt.'
                : 'Không tìm thấy sân khớp với bộ lọc hiện tại.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className={cn('space-y-3', isFetching && 'opacity-60 transition-opacity')}>
          {fields.map((f) => (
            <li key={f._id}>
              <Card>
                <CardContent className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/fields/${f._id}`} className="font-medium hover:text-primary">
                        {f.name}
                      </Link>
                      <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" aria-hidden />
                        {f.location?.address}, {f.location?.district}, {f.location?.city}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{ownerLabel(f)}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {f.isVerified && (
                        <Badge variant="outline" className="border-0 bg-emerald-100 text-emerald-700">
                          <BadgeCheck className="size-3.5" aria-hidden />
                          Đã xác minh
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn('border-0', FIELD_STATUS_COLORS[f.status])}>
                        {FIELD_STATUS_LABELS[f.status] ?? f.status}
                      </Badge>
                    </div>
                  </div>

                  <dl className="grid gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">Sân con</dt>
                      <dd className="font-medium">{f.subFields?.length ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Lượt đặt</dt>
                      <dd className="font-medium">{f.totalBookings}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Đánh giá</dt>
                      <dd className="flex items-center gap-1 font-medium">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                        {f.rating?.average?.toFixed(1) ?? '0.0'} ({f.rating?.count ?? 0})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Ngày tạo</dt>
                      <dd className="font-medium">{formatDate(f.createdAt)}</dd>
                    </div>
                  </dl>

                  {f.moderationNote && (
                    <p className="rounded-lg bg-muted/50 p-3 text-sm">
                      <span className="font-medium">Ghi chú duyệt gần nhất: </span>
                      {f.moderationNote}
                      {f.moderatedAt ? ` (${formatDate(f.moderatedAt)})` : ''}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button
                      size="sm"
                      disabled={moderate.isPending || (f.isVerified && f.status === 'active')}
                      onClick={() => {
                        setModerating({ field: f, approve: true });
                        setNote('');
                      }}
                    >
                      <CheckCircle2 className="size-4" aria-hidden />
                      Duyệt
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={moderate.isPending}
                      onClick={() => {
                        setModerating({ field: f, approve: false });
                        setNote('');
                      }}
                    >
                      <XCircle className="size-4" aria-hidden />
                      Từ chối
                    </Button>
                    <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/fields/${f._id}`} />}>
                      Xem trang sân
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
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
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} sân
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

      <Dialog open={moderating !== null} onOpenChange={(open) => !open && setModerating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {moderating?.approve ? 'Duyệt sân' : 'Từ chối sân'} {moderating?.field.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {moderating?.approve
                ? 'Sân sẽ được xác minh và chuyển sang trạng thái hoạt động.'
                : 'Sân sẽ chuyển về tạm ngưng. Hãy nêu rõ điều chủ sân cần sửa.'}
            </p>
            <Label htmlFor="moderation-note">Ghi chú cho chủ sân</Label>
            <Textarea
              id="moderation-note"
              rows={3}
              maxLength={500}
              placeholder={
                moderating?.approve ? 'Hồ sơ hợp lệ, đã xác minh.' : 'Ảnh sân không rõ, thiếu giấy phép kinh doanh...'
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModerating(null)}>
              Quay lại
            </Button>
            <Button
              variant={moderating?.approve ? 'default' : 'destructive'}
              disabled={moderate.isPending || (!moderating?.approve && note.trim().length === 0)}
              onClick={() =>
                moderating &&
                moderate.mutate({ id: moderating.field._id, approve: moderating.approve, note: note.trim() })
              }
            >
              {moderate.isPending ? 'Đang xử lý...' : moderating?.approve ? 'Duyệt sân' : 'Từ chối sân'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
