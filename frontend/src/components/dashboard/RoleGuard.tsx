'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import useAuthStore from '@/stores/authStore';
import useMounted from '@/hooks/useMounted';
import type { Role } from '@/types';

/**
 * `allow`/`deny` và hai dòng chữ từ chối luôn đi cùng nhau: khu nào chặn theo role thì phải
 * nói được vì sao, còn khu chỉ cần đăng nhập thì không có gì để giải thích.
 *
 * `deny` không phải là `allow` viết ngược: **mọi** tài khoản đều mang role `user`, kể cả
 * quản trị viên, nên "ai cũng vào được, trừ admin" không diễn đạt được bằng `allow` mà
 * không phải liệt kê hết các role còn lại — và bỏ sót mọi role thêm về sau.
 */
type RoleGuardProps = { children: React.ReactNode } & (
  | { allow: Role[]; deny?: never; deniedTitle: string; deniedDescription: string }
  | { deny: Role[]; allow?: never; deniedTitle: string; deniedDescription: string }
  | { allow?: never; deny?: never; deniedTitle?: never; deniedDescription?: never }
);

/**
 * Chặn truy cập theo role, hoặc chỉ đòi đăng nhập khi bỏ trống cả `allow` lẫn `deny`.
 * Backend vẫn kiểm tra quyền trên từng endpoint — guard này chỉ để UX rõ ràng,
 * không phải lớp bảo mật.
 */
export default function RoleGuard({ allow, deny, deniedTitle, deniedDescription, children }: RoleGuardProps) {
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

  if (deny?.some((role) => user.roles.includes(role))) {
    return (
      <BlockCard title={deniedTitle!} desc={deniedDescription!}>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Về trang chủ
        </Button>
      </BlockCard>
    );
  }

  if (allow && !allow.some((role) => user.roles.includes(role))) {
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
