'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useForgotPassword } from '@/hooks/useAuth';
import { CheckCircle } from 'lucide-react';

const schema = z.object({ email: z.string().email('Email không hợp lệ') });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPassword();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = ({ email }: { email: string }) => {
    forgotPassword.mutate(email, { onSuccess: () => setSent(true) });
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <h2 className="text-xl font-semibold">Email đã được gửi</h2>
            <p className="text-muted-foreground text-sm">
              Vui lòng kiểm tra hộp thư và nhấn vào link để đặt lại mật khẩu.
              Link có hiệu lực trong <strong>1 giờ</strong>.
            </p>
            <Link href="/login">
              <Button variant="outline">Quay lại đăng nhập</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-4xl">⚽</span>
          <h1 className="mt-2 text-2xl font-bold text-green-700">Football Platform</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quên mật khẩu</CardTitle>
            <CardDescription>Nhập email để nhận link đặt lại mật khẩu</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="example@email.com" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message as string}</p>}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={forgotPassword.isPending}>
                {forgotPassword.isPending ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
              </Button>
              <Link href="/login" className="text-sm text-green-600 hover:underline">
                Quay lại đăng nhập
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
