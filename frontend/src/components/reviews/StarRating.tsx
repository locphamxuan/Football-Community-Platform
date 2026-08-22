import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StarRating({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('flex items-center gap-0.5', className)} aria-label={`${value} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn('size-4', i < value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')}
          aria-hidden
        />
      ))}
    </span>
  );
}
