'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import fieldService, { type PromotionPayload } from '@/services/field.service';
import { formatDate, formatPrice, toDateInput } from '@/lib/format';
import type { ApiResponse, Field, Promotion } from '@/types';

const SLOT_LABELS: Record<'morning' | 'afternoon' | 'evening', string> = {
  morning: 'Sáng',
  afternoon: 'Chiều',
  evening: 'Tối',
};

const emptyDraft = (): PromotionPayload => ({
  code: '',
  type: 'percentage',
  value: 10,
  slots: [],
  startDate: toDateInput(new Date()),
  endDate: toDateInput(new Date()),
});

const describeValue = (p: Pick<Promotion, 'type' | 'value'>) =>
  p.type === 'percentage' ? `Giảm ${p.value}%` : `Giảm ${formatPrice(p.value)}`;

export default function FieldPromotions({ field }: { field: Field }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<PromotionPayload>(emptyDraft);
  const [toDelete, setToDelete] = useState<Promotion | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['owner-field', field._id] });
  };

  const onError = (err: AxiosError<ApiResponse<null>>) =>
    toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra');

  const add = useMutation({
    mutationFn: (data: PromotionPayload) => fieldService.addPromotion(field._id, data),
    onSuccess: () => {
      toast.success('Đã tạo mã khuyến mãi.');
      setAddOpen(false);
      setDraft(emptyDraft());
      invalidate();
    },
    onError,
  });

  const toggleActive = useMutation({
    mutationFn: ({ promoId, active }: { promoId: string; active: boolean }) =>
      fieldService.updatePromotion(field._id, promoId, { active }),
    onSuccess: () => {
      invalidate();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (promoId: string) => fieldService.deletePromotion(field._id, promoId),
    onSuccess: () => {
      toast.success('Đã xoá mã khuyến mãi.');
      setToDelete(null);
      invalidate();
    },
    onError,
  });

  const toggleSlot = (slot: 'morning' | 'afternoon' | 'evening') =>
    setDraft((d) => ({
      ...d,
      slots: d.slots?.includes(slot) ? d.slots.filter((s) => s !== slot) : [...(d.slots ?? []), slot],
    }));

  const valueInvalid = draft.type === 'percentage' ? draft.value <= 0 || draft.value > 100 : draft.value <= 0;
  const canSubmitDraft = draft.code.trim().length >= 3 && !valueInvalid && draft.endDate >= draft.startDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mã khuyến mãi</CardTitle>
        <CardDescription>
          Giảm giá theo phần trăm hoặc số tiền cố định, có thể giới hạn theo khung giờ và số lượt dùng.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {field.promotions.length === 0 ? (
          <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            Chưa có mã khuyến mãi nào.
          </p>
        ) : (
          <ul className="divide-y">
            {field.promotions.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-mono font-medium">{p.code}</p>
                    <Badge variant="outline" className="border-0 bg-muted">
                      {describeValue(p)}
                    </Badge>
                    {p.maxUses != null && (
                      <Badge variant="outline" className="border-0 bg-muted">
                        {p.usedCount}/{p.maxUses} lượt
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(p.startDate)} – {formatDate(p.endDate)}
                    {p.slots.length > 0 && ` · chỉ áp dụng ${p.slots.map((s) => SLOT_LABELS[s]).join(', ')}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={p.active}
                    disabled={toggleActive.isPending}
                    onCheckedChange={(active) => toggleActive.mutate({ promoId: p._id, active })}
                    aria-label={`Bật/tắt mã ${p.code}`}
                  />
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    aria-label={`Xoá mã ${p.code}`}
                    onClick={() => setToDelete(p)}
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
          Tạo mã khuyến mãi
        </Button>
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo mã khuyến mãi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="promo-code">Mã *</Label>
              <Input
                id="promo-code"
                placeholder="SALE10"
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Kiểu giảm giá</Label>
                <Select
                  value={draft.type}
                  onValueChange={(v) => v && setDraft((d) => ({ ...d, type: v as PromotionPayload['type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Phần trăm</SelectItem>
                    <SelectItem value="fixed">Số tiền cố định</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="promo-value">
                  {draft.type === 'percentage' ? 'Phần trăm giảm *' : 'Số tiền giảm *'}
                </Label>
                <Input
                  id="promo-value"
                  type="number"
                  min={0}
                  max={draft.type === 'percentage' ? 100 : undefined}
                  step={draft.type === 'percentage' ? 1 : 10000}
                  value={draft.value}
                  onChange={(e) => setDraft((d) => ({ ...d, value: Number(e.target.value) }))}
                />
                {valueInvalid && (
                  <p className="text-xs text-destructive">
                    {draft.type === 'percentage' ? 'Phải từ 1 đến 100.' : 'Phải lớn hơn 0.'}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="promo-start">Từ ngày *</Label>
                <Input
                  id="promo-start"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="promo-end">Đến ngày *</Label>
                <Input
                  id="promo-end"
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Khung giờ áp dụng (bỏ trống = toàn bộ khung giờ)</Label>
              <div className="flex gap-2">
                {(['morning', 'afternoon', 'evening'] as const).map((slot) => (
                  <Button
                    key={slot}
                    type="button"
                    variant={draft.slots?.includes(slot) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleSlot(slot)}
                  >
                    {SLOT_LABELS[slot]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="promo-max-uses">Giới hạn lượt dùng (bỏ trống = không giới hạn)</Label>
              <Input
                id="promo-max-uses"
                type="number"
                min={1}
                value={draft.maxUses ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, maxUses: e.target.value ? Number(e.target.value) : undefined }))
                }
              />
            </div>
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
              onClick={() => add.mutate({ ...draft, code: draft.code.trim() })}
            >
              {add.isPending ? 'Đang tạo...' : 'Tạo mã'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá mã {toDelete?.code}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Mã sẽ không dùng được nữa. Các lượt đặt đã áp dụng mã trước đó không bị ảnh hưởng.
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
              {remove.isPending ? 'Đang xoá...' : 'Xoá mã'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
