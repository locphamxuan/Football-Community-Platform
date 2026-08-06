'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import Logo from '@/components/layout/Logo';
import ThemeToggle from '@/components/layout/ThemeToggle';
import UserMenu from '@/components/layout/UserMenu';
import useAuthStore from '@/stores/authStore';
import useMounted from '@/hooks/useMounted';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/fields', label: 'Sân bóng' },
  { href: '/teams', label: 'Đội bóng' },
];

const MOBILE_USER_LINKS = [
  { href: '/bookings', label: 'Sân đã đặt' },
  { href: '/match-requests', label: 'Lời mời thi đấu' },
];

export default function Navbar() {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  // authStore dùng persist (localStorage) — chờ mount để tránh hydration mismatch
  const mounted = useMounted();

  const canManageFields = Boolean(
    user && (user.roles.includes('field_owner') || user.roles.includes('admin'))
  );
  const mobileUserLinks = canManageFields
    ? [...MOBILE_USER_LINKS, { href: '/owner', label: 'Quản lý sân' }]
    : MOBILE_USER_LINKS;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Điều hướng chính">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                isActive(link.href)
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
              aria-current={isActive(link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* Auth section (desktop) */}
          <div className="hidden items-center gap-2 md:flex">
            {mounted && isAuthenticated ? (
              <UserMenu />
            ) : (
              <>
                <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
                  Đăng nhập
                </Button>
                <Button nativeButton={false} render={<Link href="/register" />}>Đăng ký</Button>
              </>
            )}
          </div>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mở menu"
                  className="cursor-pointer md:hidden"
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Điều hướng di động">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
                      isActive(link.href)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                ))}
                <Separator className="my-3" />
                {mounted && isAuthenticated ? (
                  <div className="flex flex-col gap-1">
                    {mobileUserLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2.5 text-base font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      nativeButton={false} render={<Link href="/login" onClick={() => setMobileOpen(false)} />}
                    >
                      Đăng nhập
                    </Button>
                    <Button nativeButton={false} render={<Link href="/register" onClick={() => setMobileOpen(false)} />}>
                      Đăng ký
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
