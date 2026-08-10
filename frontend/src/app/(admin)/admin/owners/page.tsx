'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Mail, Phone, Search, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import adminService from '@/services/admin.service';
import billingService from '@/services/billing.service';
import {
  BOOKING_STATUS_LABELS,
  FIELD_STATUS_COLORS,
  FIELD_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  SUBSCRIPTION_STATUS_COLORS,
  SUBSCRIPTION_STATUS_LABELS,
  USER_STATUS_LABELS,
} from '@/lib/constants';
import { formatCompactPrice, formatDate, formatPrice, initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { OwnerSummary, PlanCode } from '@/types';

const ALL_PLANS = 'all';
const PAGE_SIZE = 10;

export default function AdminOwnersPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [plan, setPlan] = useState(ALL_PLANS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OwnerSummary | null>(null);

  const { data: plansRes } = useQuery({
    queryKey: ['plans'],
    queryFn: () => billingService.getPlans(),
  });
  const plans = plansRes?.data?.data?.plans ?? [];

  const filters = {
    page,
    limit: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(plan !== ALL_PLANS ? { plan: plan as PlanCode } : {}),
  };

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['admin-owners', filters],
    queryFn: () => adminService.getOwners(filters),
  });
  const owners = data?.data?.data?.owners ?? [];
  const pagination = data?.data?.meta?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Chủ sân</h1>
        <p className="text-muted-foreground">Mỗi chủ sân dùng nền tảng đến đâu và đã trả tiền thuê bao bao nhiêu</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_14rem]"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="owner-search">Tìm chủ sân</Label>
              <div className="flex gap-2">
                <Input
                  id="owner-search"
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
              <Label htmlFor="owner-plan">Gói thuê bao</Label>
              <Select
                value={plan}
                onValueChange={(v) => {
                  if (v) {
                    setPlan(v);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger id="owner-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PLANS}>Tất cả gói</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name}
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
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : owners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold">Không có chủ sân nào</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Không tìm thấy chủ sân khớp với bộ lọc hiện tại.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className={cn('space-y-3', isFetching && 'opacity-60 transition-opacity')}>
          {owners.map((o) => (
            <li key={o._id}>
              <Card>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-11">
                      <AvatarImage src={o.avatar} alt={o.fullName} />
                      <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                        {initialsOf(o.fullName || o.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{o.fullName || o.username}</p>
                      <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                        <Mail className="size-3.5 shrink-0" aria-hidden />
                        {o.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tham gia {formatDate(o.createdAt)} · {USER_STATUS_LABELS[o.status] ?? o.status}
                      </p>
                    </div>
                  </div>

                  <dl className="grid grow grid-cols-2 gap-x-6 gap-y-1 text-sm sm:max-w-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">Sân</dt>
                      <dd className="font-medium">
                        {o.activeFields}/{o.totalFields}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Lượt đặt</dt>
                      <dd className="font-medium">{o.totalBookings}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">GMV</dt>
                      <dd className="font-medium">{formatCompactPrice(o.grossMerchandiseValue)}</dd>
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <dt className="text-xs text-muted-foreground">Đã trả cho nền tảng</dt>
                      <dd className="font-medium text-primary">{formatPrice(o.totalPaid)}</dd>
                    </div>
                  </dl>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant="outline">{o.planName}</Badge>
                      <Badge
                        variant="outline"
                        className={cn('border-0', SUBSCRIPTION_STATUS_COLORS[o.subscriptionStatus])}
                      >
                        {SUBSCRIPTION_STATUS_LABELS[o.subscriptionStatus] ?? o.subscriptionStatus}
                      </Badge>
                    </div>
                    {o.currentPeriodEnd && (
                      <p className="text-xs text-muted-foreground">
                        Kỳ hiện tại đến {formatDate(o.currentPeriodEnd)}
                      </p>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setSelected(o)}>
                      Xem chi tiết
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
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} chủ sân
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

      <OwnerDetailDialog owner={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function OwnerDetailDialog({ owner, onClose }: { owner: OwnerSummary | null; onClose: () => void }) {
  const { data, isPending } = useQuery({
    queryKey: ['admin-owner-detail', owner?._id],
    queryFn: () => adminService.getOwnerDetail(owner!._id),
    enabled: owner !== null,
  });
  const detail = data?.data?.data;

  return (
    <Dialog open={owner !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{owner?.fullName || owner?.username}</DialogTitle>
        </DialogHeader>

        {isPending || !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-5">
            <section className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="size-4 shrink-0" aria-hidden />
                {detail.owner.email}
              </p>
              {detail.owner.phone && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="size-4 shrink-0" aria-hidden />
                  {detail.owner.phone}
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Thuê bao</h3>
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{detail.plan.name}</p>
                {detail.subscription ? (
                  <p className="text-muted-foreground">
                    {SUBSCRIPTION_STATUS_LABELS[detail.subscription.status] ?? detail.subscription.status} · kỳ đến{' '}
                    {formatDate(detail.subscription.currentPeriodEnd)} · đã trả{' '}
                    {formatPrice(detail.subscription.totalPaid)}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Chưa khởi tạo thuê bao — đang mặc định gói miễn phí.</p>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Sân ({detail.fields.length})</h3>
              {detail.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chủ sân này chưa đăng sân nào.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.fields.map((f) => (
                    <li key={f._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {f.location?.district}, {f.location?.city} · {f.subFields?.length ?? 0} sân con ·{' '}
                          {f.totalBookings} lượt đặt
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                          {f.rating?.average?.toFixed(1) ?? '0.0'}
                        </span>
                        <Badge variant="outline" className={cn('border-0', FIELD_STATUS_COLORS[f.status])}>
                          {FIELD_STATUS_LABELS[f.status] ?? f.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Hoá đơn gần đây</h3>
              {detail.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa phát sinh hoá đơn nào.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.invoices.map((inv) => (
                    <li key={inv._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{inv.code}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatPrice(inv.amount)}</span>
                        <Badge variant="outline" className={cn('border-0', INVOICE_STATUS_COLORS[inv.status])}>
                          {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Lượt đặt theo trạng thái</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="py-2 font-medium">Trạng thái</th>
                    <th scope="col" className="py-2 text-right font-medium">Số lượt</th>
                    <th scope="col" className="py-2 text-right font-medium">Giá trị</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(detail.bookingsByStatus).map(([status, v]) => (
                    <tr key={status} className="border-b last:border-0">
                      <th scope="row" className="py-2 text-left font-normal">
                        {BOOKING_STATUS_LABELS[status] ?? status}
                      </th>
                      <td className="py-2 text-right">{v.count}</td>
                      <td className="py-2 text-right">{formatPrice(v.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
