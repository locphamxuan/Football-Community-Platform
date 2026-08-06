'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import useAuthStore from '@/stores/authStore';
import useMounted from '@/hooks/useMounted';

/**
 * Chỉ cho chủ sân (hoặc admin) vào khu quản lý sân.
 * Backend vẫn kiểm tra role trên từng endpoint — guard này chỉ để UX rõ ràng.
 */
export default function OwnerGuard({ children }: { children: React.ReactNode }) {
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
      <BlockCard
        title="Cần đăng nhập"
        desc="Đăng nhập bằng tài khoản chủ sân để vào khu quản lý."
      >
        <Button nativeButton={false} render={<Link href="/login" />}>
          Đăng nhập
        </Button>
      </BlockCard>
    );
  }

  const canManage = user.roles.includes('field_owner') || user.roles.includes('admin');
  if (!canManage) {
    return (
      <BlockCard
        title="Tài khoản chưa phải chủ sân"
        desc="Khu quản lý sân chỉ dành cho tài khoản có quyền chủ sân. Liên hệ ban quản trị để được nâng quyền."
      >
        <Button variant="outline" nativeButton={false} render={<Link href="/fields" />}>
          Về danh sách sân
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
