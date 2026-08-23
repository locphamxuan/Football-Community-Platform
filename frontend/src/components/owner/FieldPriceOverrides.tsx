'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import fieldService, { type PriceOverridePayload } from '@/services/field.service';
import { formatDate, formatPrice, toDateInput } from '@/lib/format';
import type { ApiResponse, Field, PriceOverride } from '@/types';

const emptySlot = () => ({ morning: 0, afternoon: 0, evening: 0 });

const emptyDraft = (): PriceOverridePayload => ({
  name: '',
  startDate: toDateInput(new Date()),
  endDate: toDateInput(new Date()),
  weekday: emptySlot(),
  weekend: emptySlot(),
});

export default function FieldPriceOverrides({ field }: { field: Field }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<PriceOverridePayload>(emptyDraft);
  const [toDelete, setToDelete] = useState<PriceOverride | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['owner-field', field._id] });
  };

  const onError = (err: AxiosError<ApiResponse<null>>) =>
    toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra');

  const add = useMutation({
    mutationFn: (data: PriceOverridePayload) => fieldService.addPriceOverride(field._id, data),
    onSuccess: () => {
      toast.success('Đã thêm ghi đè giá.');
      setAddOpen(false);
      setDraft(emptyDraft());
      invalidate();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (overrideId: string) => fieldService.deletePriceOverride(field._id, overrideId),
    onSuccess: () => {
      toast.success('Đã xoá ghi đè giá.');
      setToDelete(null);
      invalidate();
    },
    onError,
  });

  const canSubmitDraft = draft.name.trim().length > 0 && draft.endDate >= draft.startDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Giá theo ngày</CardTitle>
        <CardDescription>
          Ghi đè bảng giá mặc định cho một khoảng ngày cụ thể — dịp lễ, Tết, hoặc mùa cao điểm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {field.priceOverrides.length === 0 ? (
          <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            Chưa có ghi đè nào — sân luôn dùng bảng giá mặc định.
          </p>
        ) : (
          <ul className="divide-y">
            {field.priceOverrides.map((o) => (
              <li key={o._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(o.startDate)} – {formatDate(o.endDate)} · tối {formatPrice(o.weekday.evening)}
                    /giờ ngày thường
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  aria-label={`Xoá ghi đè ${o.name}`}
                  onClick={() => setToDelete(o)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Thêm ghi đè giá
        </Button>
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm ghi đè giá</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ov-name">Tên đợt *</Label>
              <Input
                id="ov-name"
                placeholder="Tết Dương lịch"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ov-start">Từ ngày *</Label>
                <Input
                  id="ov-start"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ov-end">Đến ngày *</Label>
                <Input
                  id="ov-end"
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                />
              </div>
            </div>
            {(['weekday', 'weekend'] as const).map((kind) => (
              <div key={kind} className="space-y-1">
                <Label>{kind === 'weekday' ? 'Ngày thường' : 'Cuối tuần'}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['morning', 'afternoon', 'evening'] as const).map((slot) => (
                    <Input
                      key={slot}
                      type="number"
                      step={10000}
                      min={0}
                      aria-label={`${kind === 'weekday' ? 'Ngày thường' : 'Cuối tuần'} - ${slot}`}
                      value={draft[kind][slot]}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [kind]: { ...d[kind], [slot]: Number(e.target.value) },
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
            {draft.endDate < draft.startDate && (
              <p className="text-xs text-destructive">Ngày kết thúc phải sau ngày bắt đầu.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={!canSubmitDraft || add.isPending}
              onClick={() => add.mutate({ ...draft, name: draft.name.trim() })}
            >
              {add.isPending ? 'Đang thêm...' : 'Thêm ghi đè'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá ghi đè {toDelete?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Các ngày trong khoảng này sẽ trở lại dùng bảng giá mặc định.
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
              {remove.isPending ? 'Đang xoá...' : 'Xoá ghi đè'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
