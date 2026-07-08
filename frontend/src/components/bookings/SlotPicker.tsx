'use client';

import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SubFieldAvailability } from '@/types';
import { cn } from '@/lib/utils';

const SURFACE_LABELS: Record<string, string> = {
  natural_grass: 'Cỏ tự nhiên',
  artificial_grass: 'Cỏ nhân tạo',
  concrete: 'Bê tông',
};

interface SlotPickerProps {
  items: SubFieldAvailability[];
  selectedId?: string;
  onSelect?: (subFieldId: string) => void;
  /** Chế độ chỉ xem (lịch sân của chủ sân) — không cho chọn */
  readOnly?: boolean;
}

/** Danh sách sân con kèm tình trạng trống/bận trong khung giờ đã chọn. */
export default function SlotPicker({ items, selectedId, onSelect, readOnly = false }: SlotPickerProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Không có sân con phù hợp với bộ lọc.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((sf) => {
        const selectable = !readOnly && sf.isAvailable;
        const selected = selectedId === sf.subFieldId;
        return (
          <Card
            key={sf.subFieldId}
            role={selectable ? 'button' : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-pressed={selectable ? selected : undefined}
            onClick={() => selectable && onSelect?.(sf.subFieldId)}
            onKeyDown={(e) => {
              if (selectable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSelect?.(sf.subFieldId);
              }
            }}
            className={cn(
              'transition-all duration-200',
              selectable && 'cursor-pointer hover:border-primary/50 hover:shadow-md',
              selected && 'border-primary ring-2 ring-primary/30',
              !sf.isAvailable && 'opacity-60'
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{sf.name}</p>
                {sf.isAvailable ? (
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    <CheckCircle className="size-3" aria-hidden />
                    Trống
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="size-3" aria-hidden />
                    Đã kín
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {sf.fieldType} · {SURFACE_LABELS[sf.surface] ?? sf.surface}
              </p>
              {sf.bookedSlots.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" aria-hidden />
                  {sf.bookedSlots.map((s, i) => (
                    <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {s.startTime}–{s.endTime}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
