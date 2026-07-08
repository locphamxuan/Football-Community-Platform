'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import userService, { ChangePasswordPayload } from '@/services/user.service';
import useAuthStore from '@/stores/authStore';
import type { ApiResponse, User } from '@/types';
import { cn } from '@/lib/utils';

// ── Nhãn tiếng Việt cho enum backend ────────────────────────────────────────
const POSITIONS = [
  { value: 'goalkeeper', label: 'Thủ môn' },
  { value: 'defender', label: 'Hậu vệ' },
  { value: 'midfielder', label: 'Tiền vệ' },
  { value: 'forward', label: 'Tiền đạo' },
];
const SKILL_LEVELS = [
  { value: 'beginner', label: 'Mới chơi' },
  { value: 'intermediate', label: 'Trung bình' },
  { value: 'advanced', label: 'Khá / Giỏi' },
  { value: 'professional', label: 'Bán chuyên' },
];
const GENDERS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
];

// ── Schemas ──────────────────────────────────────────────────────────────────
const profileSchema = z.object({
  fullName: z.string().min(2, 'Tên ít nhất 2 ký tự').max(100),
  phone: z
    .string()
    .regex(/^(0|\+84)[0-9]{9}$/, 'Số điện thoại không hợp lệ')
    .optional()
    .or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']),
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  positions: z.array(z.string()).max(4),
  skillLevel: z.string(),
  bio: z.string().max(500, 'Tối đa 500 ký tự').optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(8, 'Ít nhất 8 ký tự')
      .regex(/[A-Z]/, 'Phải có chữ hoa')
      .regex(/[0-9]/, 'Phải có số'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

const apiError = (err: unknown, fallback: string) =>
  (err as AxiosError<ApiResponse<null>>)?.response?.data?.message ?? fallback;

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const qc = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['me'],
    queryFn: () => userService.getMe(),
  });
  const user: User | undefined = data?.data?.data?.user;

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Không tải được hồ sơ. Vui lòng đăng nhập lại.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileHeader user={user} />
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="password">Đổi mật khẩu</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-4">
          <ProfileInfoForm user={user} onSaved={() => qc.invalidateQueries({ queryKey: ['me'] })} />
        </TabsContent>
        <TabsContent value="password" className="mt-4">
          <ChangePasswordForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Header: avatar + thống kê ────────────────────────────────────────────────
function ProfileHeader({ user }: { user: User }) {
  const stats = user.playerProfile?.stats;
  const initials = (user.fullName || user.username || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 border-2 border-primary/20">
            <AvatarImage src={user.avatar} alt={user.fullName} />
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-heading text-2xl font-bold">{user.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              @{user.username} · {user.email}
            </p>
          </div>
        </div>

        {stats && (
          <dl className="flex gap-6 sm:ml-auto">
            {[
              { label: 'Trận', value: stats.matchesPlayed },
              { label: 'Thắng', value: stats.wins },
              { label: 'ELO', value: stats.eloRating },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <dd className="font-heading text-2xl font-bold text-primary">{s.value}</dd>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

// ── Form thông tin ───────────────────────────────────────────────────────────
function ProfileInfoForm({ user, onSaved }: { user: User; onSaved: () => void }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      fullName: user.fullName ?? '',
      phone: user.phone ?? '',
      gender: user.gender ?? 'other',
      city: user.location?.city ?? '',
      district: user.location?.district ?? '',
      positions: user.playerProfile?.positions ?? [],
      skillLevel: user.playerProfile?.skillLevel ?? 'beginner',
      bio: user.playerProfile?.bio ?? '',
    },
  });

  const update = useMutation({
    mutationFn: (form: ProfileForm) =>
      userService.updateProfile({
        fullName: form.fullName,
        phone: form.phone || undefined,
        gender: form.gender,
        location: { city: form.city, district: form.district },
        playerProfile: {
          positions: form.positions,
          skillLevel: form.skillLevel,
          bio: form.bio,
        },
      }),
    onSuccess: (res) => {
      toast.success('Cập nhật hồ sơ thành công!');
      const updated = res.data?.data?.user;
      if (updated) useAuthStore.setState({ user: updated });
      onSaved();
    },
    onError: (err) => toast.error(apiError(err, 'Cập nhật thất bại')),
  });

  const positions = watch('positions');
  const toggleIn = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin cá nhân</CardTitle>
        <CardDescription>Hồ sơ cầu thủ giúp AI ghép trận chính xác hơn</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="fullName">Họ và tên</Label>
              <Input id="fullName" {...register('fullName')} />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input id="phone" placeholder="0901234567" {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Giới tính</Label>
              <Select value={watch('gender')} onValueChange={(v) => v && setValue('gender', v as ProfileForm['gender'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="city">Tỉnh / Thành phố</Label>
                <Input id="city" placeholder="TP.HCM" {...register('city')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="district">Quận / Huyện</Label>
                <Input id="district" placeholder="Quận 1" {...register('district')} />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Vị trí sở trường (tối đa 4)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {POSITIONS.map((p) => (
                <Badge
                  key={p.value}
                  variant={positions.includes(p.value) ? 'default' : 'outline'}
                  className={cn('cursor-pointer select-none px-3 py-1')}
                  onClick={() => setValue('positions', toggleIn(positions, p.value))}
                >
                  {p.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Trình độ</Label>
              <Select value={watch('skillLevel')} onValueChange={(v) => v && setValue('skillLevel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKILL_LEVELS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bio">Giới thiệu bản thân</Label>
            <Textarea id="bio" rows={3} placeholder="Vài dòng về phong cách chơi bóng của bạn..." {...register('bio')} />
            {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
          </div>

          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Form đổi mật khẩu ────────────────────────────────────────────────────────
function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordPayload>({ resolver: zodResolver(passwordSchema) });

  const change = useMutation({
    mutationFn: (data: ChangePasswordPayload) => userService.changePassword(data),
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công!');
      reset();
    },
    onError: (err) => toast.error(apiError(err, 'Đổi mật khẩu thất bại')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đổi mật khẩu</CardTitle>
        <CardDescription>Mật khẩu mới cần ít nhất 8 ký tự, có chữ hoa và số</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => change.mutate(d))} className="max-w-md space-y-4">
          <div className="space-y-1">
            <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
            <Input id="currentPassword" type="password" {...register('currentPassword')} />
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <Input id="newPassword" type="password" {...register('newPassword')} />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
            <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
