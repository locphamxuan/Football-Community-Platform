'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useRegister } from '@/hooks/useAuth';

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Tên ít nhất 2 ký tự'),
    username: z
      .string()
      .min(3, 'Username ít nhất 3 ký tự')
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, 'Chỉ chứa chữ, số và dấu gạch dưới'),
    email: z.string().email('Email không hợp lệ'),
    phone: z.string().regex(/^(0|\+84)[0-9]{9}$/, 'Số điện thoại không hợp lệ').optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'Ít nhất 8 ký tự')
      .regex(/[A-Z]/, 'Phải có chữ hoa')
      .regex(/[0-9]/, 'Phải có số'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const register_ = useRegister();
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = ({ confirmPassword: _, ...data }: RegisterForm) => {
    register_.mutate({ ...data, phone: data.phone || undefined });
  };

  return (
    <Card>
          <CardHeader>
            <CardTitle>Tạo tài khoản</CardTitle>
            <CardDescription>Tham gia cộng đồng bóng đá phong trào</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-3">
              {/* Full Name */}
              <div className="space-y-1">
                <Label htmlFor="fullName">Họ và tên</Label>
                <Input id="fullName" placeholder="Nguyễn Văn A" {...register('fullName')} />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
              </div>

              {/* Username */}
              <div className="space-y-1">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="nguyen_van_a" {...register('username')} />
                {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="example@email.com" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <Label htmlFor="phone">Số điện thoại (tuỳ chọn)</Label>
                <Input id="phone" placeholder="0901234567" {...register('phone')} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={register_.isPending}>
                {register_.isPending ? 'Đang xử lý...' : 'Đăng ký'}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Đã có tài khoản?{' '}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Đăng nhập
                </Link>
              </p>
            </CardFooter>
          </form>
    </Card>
  );
}
