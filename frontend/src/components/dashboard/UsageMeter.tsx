import { Volleyball } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  suffix: string;
}

/** Thanh đo mức sử dụng so với hạn mức gói; -1 nghĩa là không giới hạn. */
export default function UsageMeter({ label, used, limit, suffix }: UsageMeterProps) {
  const unlimited = limit < 0;
  const ratio = unlimited ? 0 : Math.min(used / Math.max(limit, 1), 1);
  const nearLimit = !unlimited && ratio >= 0.8;

  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Volleyball className="size-4" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="font-heading text-lg font-bold">
        {used}
        <span className="text-sm font-normal text-muted-foreground">
          {unlimited ? ` ${suffix} · không giới hạn` : ` / ${limit} ${suffix}`}
        </span>
      </p>
      {!unlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', nearLimit ? 'bg-amber-500' : 'bg-primary')}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
