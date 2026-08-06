'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, LayoutDashboard, Volleyball } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIDEBAR_LINKS = [
  { href: '/owner', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
  { href: '/owner/fields', label: 'Sân của tôi', icon: Volleyball, exact: false },
  { href: '/owner/bookings', label: 'Lịch đặt sân', icon: CalendarCheck, exact: false },
];

/**
 * Điều hướng khu quản lý sân.
 * Desktop: sidebar dọc bên trái. Mobile: thanh tab ngang phía trên nội dung.
 */
export default function OwnerSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Quản lý sân"
      className="flex gap-1 overflow-x-auto border-b pb-2 md:w-56 md:shrink-0 md:flex-col md:border-b-0 md:pb-0"
    >
      {SIDEBAR_LINKS.map(({ href, label, icon: Icon, exact }) => {
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
