import Link from 'next/link';
import { Volleyball } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2', className)} aria-label="MatchBall — Trang chủ">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Volleyball className="size-5" />
      </span>
      <span className="font-heading text-2xl font-bold tracking-tight">
        Match<span className="text-primary">Ball</span>
      </span>
    </Link>
  );
}
