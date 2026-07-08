'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import type { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import authService from '@/services/auth.service';
import type { ApiResponse } from '@/types';

function VerifyEmailContent() {
  const token = useSearchParams().get('token') ?? '';

  const { status, error } = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => authService.verifyEmail(token),
    enabled: token.length > 0,
    retry: false, // token chỉ dùng 1 lần — retry sẽ luôn fail
    staleTime: Infinity, // không refetch (StrictMode/remount) — lần 2 sẽ luôn 400
    refetchOnWindowFocus: false,
  });

  // Không có token trên URL
  if (!token) {
    return (
      <VerifyCard
        icon={<XCircle className="h-16 w-16 text-destructive" aria-hidden />}
        title="Link không hợp lệ"
        desc="Đường dẫn xác thực thiếu mã token. Vui lòng mở đúng link trong email."
      />
    );
  }

  if (status === 'pending') {
    return (
      <VerifyCard
        icon={<Loader2 className="h-16 w-16 animate-spin text-primary" aria-hidden />}
        title="Đang xác thực email..."
        desc="Vui lòng chờ trong giây lát."
      />
    );
  }

  if (status === 'error') {
    const message =
      (error as AxiosError<ApiResponse<null>>)?.response?.data?.message ??
      'Token không hợp lệ hoặc đã hết hạn.';
    return (
      <VerifyCard
        icon={<XCircle className="h-16 w-16 text-destructive" aria-hidden />}
        title="Xác thực thất bại"
        desc={message}
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
            Về trang đăng nhập
          </Button>
        }
      />
    );
  }

  return (
    <VerifyCard
      icon={<CheckCircle className="h-16 w-16 text-primary" aria-hidden />}
      title="Xác thực thành công!"
      desc="Tài khoản của bạn đã được kích hoạt. Giờ bạn có thể đăng nhập."
      action={
        <Button nativeButton={false} render={<Link href="/login" />}>
          Đăng nhập ngay
        </Button>
      }
    />
  );
}

function VerifyCard({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="text-center">
      <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6">
        {icon}
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
