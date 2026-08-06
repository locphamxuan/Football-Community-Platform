'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FieldForm from '@/components/owner/FieldForm';
import fieldService from '@/services/field.service';
import type { ApiResponse } from '@/types';

export default function NewFieldPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (formData: FormData) => fieldService.createField(formData),
    onSuccess: (res) => {
      toast.success('Đã tạo sân. Sân sẽ hiển thị công khai sau khi ban quản trị xác thực.');
      qc.invalidateQueries({ queryKey: ['owner-fields'] });
      qc.invalidateQueries({ queryKey: ['owner-stats'] });
      router.push(`/owner/fields/${res.data.data.field._id}`);
    },
    onError: (err: AxiosError<ApiResponse<null>>) => {
      toast.error(err.response?.data?.message ?? 'Tạo sân thất bại');
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/owner/fields" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Sân của tôi
        </Button>
        <div>
          <h1 className="font-heading text-3xl font-bold">Thêm sân mới</h1>
          <p className="text-muted-foreground">
            Sau khi tạo, hãy thêm các sân con để bắt đầu nhận đặt sân.
          </p>
        </div>
      </div>

      <FieldForm submitLabel="Tạo sân" pending={create.isPending} onSubmit={create.mutate} />
    </div>
  );
}
