'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import {
  CalendarCheck,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
  Volleyball,
} from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import fieldService from '@/services/field.service';
import { FIELD_STATUS_COLORS, FIELD_STATUS_LABELS } from '@/lib/constants';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ApiResponse, Field } from '@/types';

export default function OwnerFieldsPage() {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<Field | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['owner-fields'],
    queryFn: () => fieldService.getMyFields(),
  });
  const fields = data?.data?.data?.fields ?? [];

  const remove = useMutation({
    mutationFn: (id: string) => fieldService.deleteField(id),
    onSuccess: () => {
      toast.success('Đã xoá sân.');
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['owner-fields'] });
      qc.invalidateQueries({ queryKey: ['owner-stats'] });
    },
    onError: (err: AxiosError<ApiResponse<null>>) => {
      toast.error(err.response?.data?.message ?? 'Xoá sân thất bại');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">Sân của tôi</h1>
          <p className="text-muted-foreground">Quản lý thông tin, sân con và giá thuê</p>
        </div>
        <Button nativeButton={false} render={<Link href="/owner/fields/new" />}>
          <Plus className="size-4" aria-hidden />
          Thêm sân mới
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : fields.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Volleyball className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold">Bạn chưa có sân nào</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Thêm sân đầu tiên để bắt đầu nhận đặt sân. Sân mới cần ban quản trị xác thực trước khi
              hiển thị công khai.
            </p>
            <Button nativeButton={false} render={<Link href="/owner/fields/new" />}>
              <Plus className="size-4" aria-hidden />
              Thêm sân mới
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {fields.map((field) => (
            <li key={field._id}>
              <Card>
                <CardContent className="flex flex-col gap-4 py-4 sm:flex-row">
                  <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-28 sm:w-44">
                    {field.images[0] ? (
                      <Image
                        src={field.images[0]}
                        alt={field.name}
                        fill
                        sizes="176px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Volleyball className="size-8 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-heading text-lg font-semibold">{field.name}</h2>
                      <Badge
                        variant="outline"
                        className={cn('border-0', FIELD_STATUS_COLORS[field.status])}
                      >
                        {FIELD_STATUS_LABELS[field.status]}
                      </Badge>
                      {!field.isVerified && (
                        <Badge variant="outline">Chưa xác thực</Badge>
                      )}
                    </div>

                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        {field.location.address}, {field.location.district}, {field.location.city}
                      </span>
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Volleyball className="size-4" aria-hidden />
                        {field.subFields.length} sân con
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarCheck className="size-4" aria-hidden />
                        {field.totalBookings} lượt đặt
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Star className="size-4" aria-hidden />
                        {field.rating.count > 0
                          ? `${field.rating.average.toFixed(1)} (${field.rating.count})`
                          : 'Chưa có đánh giá'}
                      </span>
                      <span>Tối cuối tuần từ {formatPrice(field.pricing.weekend.evening)}/giờ</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-start gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/owner/bookings?fieldId=${field._id}`} />}
                    >
                      <CalendarCheck className="size-4" aria-hidden />
                      Lịch đặt
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/owner/fields/${field._id}`} />}
                    >
                      <Pencil className="size-4" aria-hidden />
                      Sửa
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      aria-label={`Xoá sân ${field.name}`}
                      onClick={() => setToDelete(field)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá sân {toDelete?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Toàn bộ sân con và hình ảnh sẽ bị xoá vĩnh viễn. Nếu sân còn lịch đặt chưa kết thúc, hãy
            chuyển sang trạng thái <strong>Tạm ngưng</strong> thay vì xoá.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => toDelete && remove.mutate(toDelete._id)}
            >
              {remove.isPending ? 'Đang xoá...' : 'Xoá sân'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
