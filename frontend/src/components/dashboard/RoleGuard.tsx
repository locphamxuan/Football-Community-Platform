'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import useAuthStore from '@/stores/authStore';
import useMounted from '@/hooks/useMounted';
import type { Role } from '@/types';

interface RoleGuardProps {
  /** Chỉ cần một trong các role này là vào được. */
  allow: Role[];
  deniedTitle: string;
  deniedDescription: string;
  children: React.ReactNode;
}

/**
 * Chặn truy cập khu quản lý theo role.
 * Backend vẫn kiểm tra quyền trên từng endpoint — guard này chỉ để UX rõ ràng,
 * không phải lớp bảo mật.
 */
export default function RoleGuard({ allow, deniedTitle, deniedDescription, children }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // authStore dùng persist (localStorage) — chờ mount để tránh hydration mismatch
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <BlockCard title="Cần đăng nhập" desc="Đăng nhập để vào khu quản lý này.">
        <Button nativeButton={false} render={<Link href="/login" />}>
          Đăng nhập
        </Button>
      </BlockCard>
    );
  }

  if (!allow.some((role) => user.roles.includes(role))) {
    return (
      <BlockCard title={deniedTitle} desc={deniedDescription}>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Về trang chủ
        </Button>
      </BlockCard>
    );
  }

  return <>{children}</>;
}

function BlockCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardContent className="flex flex-col items-center gap-3 py-10">
        <ShieldAlert className="size-10 text-muted-foreground" aria-hidden />
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
        {children}
      </CardContent>
    </Card>
  );
}
