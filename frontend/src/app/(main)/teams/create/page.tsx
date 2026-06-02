'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import teamService from '@/services/team.service';
import { SKILL_LEVEL_LABELS, FIELD_TYPES } from '@/lib/constants';
import { toast } from 'sonner';
import { Shield, Upload } from 'lucide-react';
import Image from 'next/image';

const schema = z.object({
  name: z.string().min(3, 'Tên đội tối thiểu 3 ký tự').max(100),
  description: z.string().max(1000).optional(),
  homeCity: z.string().max(100).optional(),
  homeDistrict: z.string().max(100).optional(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced', 'professional']).optional(),
  fieldSize: z.enum(['5v5', '7v7', '11v11']).optional(),
  maxMembers: z.number().int().min(5).max(30).optional(),
  isPublic: z.boolean().optional(),
});

type Form = z.infer<typeof schema>;

export default function CreateTeamPage() {
  const router = useRouter();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { skillLevel: 'beginner', fieldSize: '7v7', maxMembers: 15, isPublic: true },
  });

  const isPublic = watch('isPublic');

  const mutation = useMutation({
    mutationFn: (data: Form) => {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== '') fd.append(k, String(v));
      });
      if (logoFile) fd.append('file', logoFile);
      return teamService.createTeam(fd);
    },
    onSuccess: (res) => {
      toast.success('Tạo đội thành công!');
      router.push(`/teams/${res.data.data.team._id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Có lỗi xảy ra';
      toast.error(msg);
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tạo đội bóng mới</h1>
        <p className="text-muted-foreground mt-1">Xây dựng đội bóng và thách đấu cộng đồng</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Thông tin cơ bản</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 rounded-full bg-green-50 border-2 border-dashed border-green-200 flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <Image src={logoPreview} alt="logo" fill className="object-cover" />
                ) : (
                  <Shield className="h-8 w-8 text-green-400" />
                )}
              </div>
              <div>
                <label htmlFor="logo" className="cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700">
                    <Upload className="h-4 w-4" />
                    <span>Tải logo lên</span>
                  </div>
                </label>
                <input id="logo" type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG tối đa 5MB</p>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">Tên đội *</Label>
              <Input id="name" placeholder="FC Hà Nội United" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea id="description" placeholder="Giới thiệu về đội bóng..." rows={3} {...register('description')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Thành phố</Label>
                <Input placeholder="Hà Nội" {...register('homeCity')} />
              </div>
              <div className="space-y-1">
                <Label>Quận/Huyện</Label>
                <Input placeholder="Đống Đa" {...register('homeDistrict')} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Cài đặt đội</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Trình độ</Label>
                <Select defaultValue="beginner" onValueChange={(v) => setValue('skillLevel', v as Form['skillLevel'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SKILL_LEVEL_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Loại sân ưa thích</Label>
                <Select defaultValue="7v7" onValueChange={(v) => setValue('fieldSize', v as Form['fieldSize'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Số thành viên tối đa</Label>
              <Input type="number" min={5} max={30} defaultValue={15} {...register('maxMembers', { valueAsNumber: true })} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Đội công khai</p>
                <p className="text-xs text-muted-foreground">Cho phép mọi người tìm thấy và tham gia</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={(v) => setValue('isPublic', v)} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={mutation.isPending}>
          {mutation.isPending ? 'Đang tạo...' : 'Tạo đội bóng'}
        </Button>
      </form>
    </div>
  );
}
