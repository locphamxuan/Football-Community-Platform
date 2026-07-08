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
      <Card className="text-center">
        <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4">
          <CheckCircle className="h-16 w-16 text-primary" />
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
    );
  }

  return (
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
              <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                {forgotPassword.isPending ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
              </Button>
              <Link href="/login" className="text-sm text-primary hover:underline">
                Quay lại đăng nhập
              </Link>
            </CardFooter>
          </form>
    </Card>
  );
}
