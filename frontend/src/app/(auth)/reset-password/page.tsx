'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useResetPassword } from '@/hooks/useAuth';

const schema = z
  .object({
    password: z.string().min(8).regex(/[A-Z]/, 'Phải có chữ hoa').regex(/[0-9]/, 'Phải có số'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu không khớp',
    path: ['confirmPassword'],
  });

type Form = z.infer<typeof schema>;

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const resetPassword = useResetPassword();

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = ({ password }: Form) => resetPassword.mutate({ token, password });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đặt lại mật khẩu</CardTitle>
        <CardDescription>Nhập mật khẩu mới cho tài khoản của bạn</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="password">Mật khẩu mới</Label>
            <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
            <Input id="confirmPassword" type="password" placeholder="••••••••" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={resetPassword.isPending}>
            {resetPassword.isPending ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-4xl">⚽</span>
          <h1 className="mt-2 text-2xl font-bold text-green-700">Football Platform</h1>
        </div>

        <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
