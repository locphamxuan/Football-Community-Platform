'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import fieldService, { type SubFieldPayload } from '@/services/field.service';
import {
  FIELD_TYPES,
  SUBFIELD_STATUS_COLORS,
  SUBFIELD_STATUS_LABELS,
  SURFACE_LABELS,
  SURFACES,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ApiResponse, Field, SubField } from '@/types';

/** Số người mặc định gợi ý theo loại sân (backend giới hạn 6–22). */
const DEFAULT_CAPACITY: Record<SubField['fieldType'], number> = {
  '5v5': 10,
  '7v7': 14,
  '11v11': 22,
};

const emptyDraft = (): SubFieldPayload => ({
  name: '',
  fieldType: '7v7',
  surface: 'artificial_grass',
  capacity: DEFAULT_CAPACITY['7v7'],
});

export default function SubFieldManager({ field }: { field: Field }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<SubFieldPayload>(emptyDraft);
  const [toDelete, setToDelete] = useState<SubField | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['owner-field', field._id] });
    qc.invalidateQueries({ queryKey: ['owner-fields'] });
  };

  const onError = (err: AxiosError<ApiResponse<null>>) =>
    toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra');

  const add = useMutation({
    mutationFn: (data: SubFieldPayload) => fieldService.addSubField(field._id, data),
    onSuccess: () => {
      toast.success('Đã thêm sân con.');
      setAddOpen(false);
      setDraft(emptyDraft());
      invalidate();
    },
    onError,
  });

  const updateStatus = useMutation({
    mutationFn: ({ subFieldId, status }: { subFieldId: string; status: SubField['status'] }) =>
      fieldService.updateSubField(field._id, subFieldId, { status }),
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái sân con.');
      invalidate();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (subFieldId: string) => fieldService.deleteSubField(field._id, subFieldId),
    onSuccess: () => {
      toast.success('Đã xoá sân con.');
      setToDelete(null);
      invalidate();
    },
    onError,
  });

  const capacityInvalid = draft.capacity < 6 || draft.capacity > 22;
  const canSubmitDraft = draft.name.trim().length > 0 && !capacityInvalid;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sân con</CardTitle>
        <CardDescription>
          Khách đặt theo từng sân con. Chuyển sang <em>Đang bảo trì</em> để tạm ngưng một sân con mà
          không ảnh hưởng các sân còn lại.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {field.subFields.length === 0 ? (
          <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            Chưa có sân con nào — sân chưa thể nhận đặt. Thêm ít nhất một sân con.
          </p>
        ) : (
          <ul className="divide-y">
            {field.subFields.map((sub) => (
              <li key={sub._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{sub.name}</p>
                    <Badge
                      variant="outline"
                      className={cn('border-0', SUBFIELD_STATUS_COLORS[sub.status])}
                    >
                      {SUBFIELD_STATUS_LABELS[sub.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {sub.fieldType} · {SURFACE_LABELS[sub.surface] ?? sub.surface} · {sub.capacity}{' '}
                    người
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={sub.status}
                    onValueChange={(v) =>
                      v && updateStatus.mutate({ subFieldId: sub._id, status: v as SubField['status'] })
                    }
                  >
                    <SelectTrigger className="w-40" aria-label={`Trạng thái ${sub.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SUBFIELD_STATUS_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    aria-label={`Xoá sân con ${sub.name}`}
                    onClick={() => setToDelete(sub)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Thêm sân con
        </Button>
      </CardContent>

      {/* Thêm sân con */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm sân con</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sub-name">Tên sân con *</Label>
              <Input
                id="sub-name"
                placeholder="Sân A"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Loại sân</Label>
              <Select
                value={draft.fieldType}
                onValueChange={(v) =>
                  v &&
                  setDraft((d) => ({
                    ...d,
                    fieldType: v as SubField['fieldType'],
                    capacity: DEFAULT_CAPACITY[v as SubField['fieldType']],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Mặt sân</Label>
              <Select
                value={draft.surface}
                onValueChange={(v) => v && setDraft((d) => ({ ...d, surface: v as SubField['surface'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SURFACES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SURFACE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sub-capacity">Số người tối đa *</Label>
              <Input
                id="sub-capacity"
                type="number"
                min={6}
                max={22}
                value={draft.capacity}
                onChange={(e) => setDraft((d) => ({ ...d, capacity: Number(e.target.value) }))}
              />
              {capacityInvalid && (
                <p className="text-xs text-destructive">Số người phải từ 6 đến 22.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={!canSubmitDraft || add.isPending}
              onClick={() => add.mutate({ ...draft, name: draft.name.trim() })}
            >
              {add.isPending ? 'Đang thêm...' : 'Thêm sân con'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Xoá sân con */}
      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá sân con {toDelete?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Các lịch đặt đã có vẫn được giữ nhưng sẽ không còn tên sân con. Nếu chỉ muốn tạm ngưng,
            hãy đổi trạng thái sang <strong>Đang bảo trì</strong>.
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
              {remove.isPending ? 'Đang xoá...' : 'Xoá sân con'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
