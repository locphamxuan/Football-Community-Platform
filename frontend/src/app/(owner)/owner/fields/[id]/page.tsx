'use client';

import { use } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import FieldForm from '@/components/owner/FieldForm';
import FieldPriceOverrides from '@/components/owner/FieldPriceOverrides';
import FieldPromotions from '@/components/owner/FieldPromotions';
import SubFieldManager from '@/components/owner/SubFieldManager';
import fieldService from '@/services/field.service';
import { FIELD_STATUS_COLORS, FIELD_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ApiResponse } from '@/types';

export default function EditFieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['owner-field', id],
    queryFn: () => fieldService.getFieldById(id),
  });
  const field = data?.data?.data?.field;

  const onError = (err: AxiosError<ApiResponse<null>>) =>
    toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['owner-field', id] });
    qc.invalidateQueries({ queryKey: ['owner-fields'] });
    qc.invalidateQueries({ queryKey: ['owner-stats'] });
  };

  const update = useMutation({
    mutationFn: (formData: FormData) => fieldService.updateField(id, formData),
    onSuccess: () => {
      toast.success('Đã lưu thay đổi.');
      invalidate();
    },
    onError,
  });

  const toggleStatus = useMutation({
    mutationFn: (nextActive: boolean) => {
      const fd = new FormData();
      fd.append('status', nextActive ? 'active' : 'inactive');
      return fieldService.updateField(id, fd);
    },
    onSuccess: (_res, nextActive) => {
      toast.success(nextActive ? 'Sân đã mở nhận đặt.' : 'Sân đã tạm ngưng nhận đặt.');
      invalidate();
    },
    onError,
  });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!field) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <h2 className="text-xl font-semibold">Không tìm thấy sân</h2>
          <p className="text-sm text-muted-foreground">Sân không tồn tại hoặc đã bị gỡ.</p>
          <Button variant="outline" nativeButton={false} render={<Link href="/owner/fields" />}>
            Về danh sách sân
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/owner/fields" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Sân của tôi
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-bold">{field.name}</h1>
          <Badge variant="outline" className={cn('border-0', FIELD_STATUS_COLORS[field.status])}>
            {FIELD_STATUS_LABELS[field.status]}
          </Badge>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/fields/${field._id}`} />}>
            <ExternalLink className="size-4" aria-hidden />
            Xem trang công khai
          </Button>
        </div>
      </div>

      {/* Trạng thái nhận đặt sân */}
      <Card>
        <CardHeader>
          <CardTitle>Nhận đặt sân</CardTitle>
          <CardDescription>
            Tạm ngưng để ẩn sân khỏi tìm kiếm mà không xoá dữ liệu. Lịch đặt đã xác nhận vẫn giữ
            nguyên.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">
                {field.status === 'active' ? 'Đang nhận đặt sân' : 'Đang tạm ngưng'}
              </p>
              <p className="text-xs text-muted-foreground">
                {field.status === 'active'
                  ? 'Sân hiển thị công khai và khách có thể đặt.'
                  : 'Khách không tìm thấy và không thể đặt sân này.'}
              </p>
            </div>
            <Switch
              checked={field.status === 'active'}
              disabled={!field.isVerified || toggleStatus.isPending}
              onCheckedChange={(v) => toggleStatus.mutate(v)}
              aria-label="Bật/tắt nhận đặt sân"
            />
          </div>

          {!field.isVerified && (
            <p className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              Sân đang chờ ban quản trị xác thực. Sau khi được xác thực, bạn mới có thể bật nhận đặt
              sân.
            </p>
          )}
        </CardContent>
      </Card>

      <SubFieldManager field={field} />
      <FieldPriceOverrides field={field} />
      <FieldPromotions field={field} />

      <div>
        <h2 className="mb-3 font-heading text-xl font-semibold">Thông tin sân</h2>
        <FieldForm
          field={field}
          submitLabel="Lưu thay đổi"
          pending={update.isPending}
          onSubmit={update.mutate}
        />
      </div>
    </div>
  );
}
