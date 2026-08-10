import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  /** Chênh lệch so với kỳ trước, tính bằng phần trăm. */
  delta?: number | null;
  accent?: boolean;
}

/**
 * Thẻ số liệu dùng chung cho cả ba khu quản lý.
 * Con số là nhân vật chính: nhãn và chú thích luôn ở màu chữ phụ, không nhuộm màu theo trạng thái.
 */
export default function StatCard({ icon, label, value, hint, delta, accent = false }: StatCardProps) {
  const showDelta = typeof delta === 'number' && Number.isFinite(delta);

  return (
    <Card className={cn(accent && 'border-primary/40 bg-primary/5')}>
      <CardContent className="space-y-1 py-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="font-heading text-2xl font-bold">{value}</p>
          {showDelta && (
            <span
              className={cn(
                'text-xs font-medium',
                delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
              )}
            >
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta)}%
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
