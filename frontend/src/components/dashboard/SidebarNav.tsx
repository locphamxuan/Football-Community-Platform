'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** true = chỉ active khi khớp chính xác (dùng cho trang tổng quan gốc). */
  exact?: boolean;
}

/**
 * Điều hướng dùng chung cho các khu quản lý.
 * Desktop: sidebar dọc bên trái. Mobile: thanh tab ngang phía trên nội dung.
 */
export default function SidebarNav({ links, ariaLabel }: { links: SidebarLink[]; ariaLabel: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto border-b pb-2 md:w-56 md:shrink-0 md:flex-col md:border-b-0 md:pb-0"
    >
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
