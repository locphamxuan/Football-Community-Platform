'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ImagePlus, Volleyball, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AMENITIES, AMENITY_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Field } from '@/types';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const priceSlot = z.object({
  morning: z.number({ message: 'Nhập giá' }).min(0, 'Giá không được âm'),
  afternoon: z.number({ message: 'Nhập giá' }).min(0, 'Giá không được âm'),
  evening: z.number({ message: 'Nhập giá' }).min(0, 'Giá không được âm'),
});

const schema = z.object({
  name: z.string().min(3, 'Tên sân tối thiểu 3 ký tự').max(100, 'Tên sân tối đa 100 ký tự'),
  description: z.string().max(2000, 'Mô tả tối đa 2000 ký tự').optional(),
  location: z.object({
    address: z.string().min(5, 'Địa chỉ tối thiểu 5 ký tự'),
    city: z.string().min(1, 'Nhập tỉnh/thành phố'),
    district: z.string().min(1, 'Nhập quận/huyện'),
    ward: z.string().optional(),
  }),
  pricing: z.object({ weekday: priceSlot, weekend: priceSlot }),
  operatingHours: z.object({
    open: z.string().regex(TIME, 'Giờ không hợp lệ (HH:mm)'),
    close: z.string().regex(TIME, 'Giờ không hợp lệ (HH:mm)'),
  }),
  cancellationPolicy: z.string().max(500, 'Chính sách tối đa 500 ký tự').optional(),
  rulesText: z.string().optional(),
}).refine((d) => d.operatingHours.open < d.operatingHours.close, {
  message: 'Giờ đóng cửa phải sau giờ mở cửa',
  path: ['operatingHours', 'close'],
});

export type FieldFormValues = z.infer<typeof schema>;

/** Dữ liệu gửi lên API — nested key được JSON.stringify vì body là multipart. */
export interface FieldFormSubmit {
  formData: FormData;
}

const EMPTY_PRICING = { morning: 0, afternoon: 0, evening: 0 };

const buildFormData = (
  values: FieldFormValues,
  amenities: string[],
  newImages: File[],
  removedImages: string[]
) => {
  const fd = new FormData();
  fd.append('name', values.name);
  if (values.description) fd.append('description', values.description);
  if (values.cancellationPolicy) fd.append('cancellationPolicy', values.cancellationPolicy);

  fd.append('location', JSON.stringify(values.location));
  fd.append('pricing', JSON.stringify(values.pricing));
  fd.append('operatingHours', JSON.stringify(values.operatingHours));
  fd.append('amenities', JSON.stringify(amenities));
  fd.append(
    'rules',
    JSON.stringify(
      (values.rulesText ?? '')
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, 20)
    )
  );
  if (removedImages.length > 0) fd.append('removeImages', JSON.stringify(removedImages));
  newImages.forEach((file) => fd.append('images', file));

  return fd;
};

export default function FieldForm({
  field,
  submitLabel,
  pending,
  onSubmit,
}: {
  /** Có giá trị khi đang sửa sân sẵn có. */
  field?: Field;
  submitLabel: string;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const [amenities, setAmenities] = useState<string[]>(field?.amenities ?? []);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FieldFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: field?.name ?? '',
      description: field?.description ?? '',
      location: {
        address: field?.location.address ?? '',
        city: field?.location.city ?? '',
        district: field?.location.district ?? '',
        ward: field?.location.ward ?? '',
      },
      pricing: {
        weekday: field?.pricing.weekday ?? EMPTY_PRICING,
        weekend: field?.pricing.weekend ?? EMPTY_PRICING,
      },
      operatingHours: {
        open: field?.operatingHours.open ?? '06:00',
        close: field?.operatingHours.close ?? '23:00',
      },
      cancellationPolicy: '',
      rulesText: (field?.rules ?? []).join('\n'),
    },
  });

  const keptImages = (field?.images ?? []).filter((img) => !removedImages.includes(img));

  const handlePickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    // Backend nhận tối đa 8 ảnh mỗi request
    setNewImages((prev) => [...prev, ...picked].slice(0, 8));
    e.target.value = '';
  };

  const toggleAmenity = (value: string) =>
    setAmenities((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit((values) =>
        onSubmit(buildFormData(values, amenities, newImages, removedImages))
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>Thông tin cơ bản</CardTitle>
          <CardDescription>Tên và mô tả hiển thị cho người tìm sân</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Tên sân *</Label>
            <Input id="name" placeholder="Sân bóng Thành Đạt" {...register('name')} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Sân cỏ nhân tạo, đèn chiếu sáng, có phòng thay đồ..."
              {...register('description')}
            />
            <FieldError message={errors.description?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Địa chỉ</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="address">Địa chỉ chi tiết *</Label>
            <Input id="address" placeholder="123 Nguyễn Trãi" {...register('location.address')} />
            <FieldError message={errors.location?.address?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="city">Tỉnh/Thành phố *</Label>
            <Input id="city" placeholder="Hà Nội" {...register('location.city')} />
            <FieldError message={errors.location?.city?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="district">Quận/Huyện *</Label>
            <Input id="district" placeholder="Thanh Xuân" {...register('location.district')} />
            <FieldError message={errors.location?.district?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ward">Phường/Xã</Label>
            <Input id="ward" placeholder="Thượng Đình" {...register('location.ward')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Giá thuê theo giờ</CardTitle>
          <CardDescription>
            Giá áp theo khung giờ bắt đầu: sáng 06–12h, chiều 12–18h, tối 18–23h
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(['weekday', 'weekend'] as const).map((kind) => (
            <div key={kind} className="space-y-2">
              <p className="text-sm font-medium">
                {kind === 'weekday' ? 'Ngày thường (T2–T6)' : 'Cuối tuần (T7, CN)'}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(['morning', 'afternoon', 'evening'] as const).map((slot) => (
                  <div key={slot} className="space-y-1">
                    <Label htmlFor={`${kind}-${slot}`}>
                      {slot === 'morning' ? 'Sáng' : slot === 'afternoon' ? 'Chiều' : 'Tối'} (VNĐ)
                    </Label>
                    <Input
                      id={`${kind}-${slot}`}
                      type="number"
                      min={0}
                      step={10000}
                      {...register(`pricing.${kind}.${slot}`, { valueAsNumber: true })}
                    />
                    <FieldError message={errors.pricing?.[kind]?.[slot]?.message} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Giờ mở cửa & tiện ích</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="open">Mở cửa *</Label>
              <Input id="open" type="time" {...register('operatingHours.open')} />
              <FieldError message={errors.operatingHours?.open?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="close">Đóng cửa *</Label>
              <Input id="close" type="time" {...register('operatingHours.close')} />
              <FieldError message={errors.operatingHours?.close?.message} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tiện ích</legend>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => {
                const on = amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleAmenity(a)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors',
                      on
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent/60'
                    )}
                  >
                    {AMENITY_LABELS[a] ?? a}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor="rulesText">Nội quy sân</Label>
            <Textarea
              id="rulesText"
              rows={3}
              placeholder={'Mỗi dòng một nội quy\nKhông mang đồ uống có ga vào sân\nĐến trước giờ đá 10 phút'}
              {...register('rulesText')}
            />
            <p className="text-xs text-muted-foreground">Mỗi dòng là một nội quy, tối đa 20 dòng.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cancellationPolicy">Chính sách huỷ</Label>
            <Textarea
              id="cancellationPolicy"
              rows={2}
              placeholder="Huỷ trước 24 giờ được hoàn 100%..."
              {...register('cancellationPolicy')}
            />
            <FieldError message={errors.cancellationPolicy?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hình ảnh</CardTitle>
          <CardDescription>Tối đa 8 ảnh mỗi lần tải lên, mỗi ảnh dưới 5MB</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {keptImages.map((img) => (
              <ImageTile
                key={img}
                src={img}
                alt="Ảnh sân"
                onRemove={() => setRemovedImages((prev) => [...prev, img])}
              />
            ))}
            {newImages.map((file, i) => (
              <ImageTile
                key={`${file.name}-${i}`}
                src={URL.createObjectURL(file)}
                alt={file.name}
                onRemove={() => setNewImages((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}

            <label
              htmlFor="images"
              className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/40 text-primary hover:bg-primary/5"
            >
              <ImagePlus className="size-5" aria-hidden />
              <span className="text-xs">Thêm ảnh</span>
            </label>
            <input
              id="images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handlePickImages}
            />
          </div>
          {keptImages.length === 0 && newImages.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Volleyball className="size-4" aria-hidden />
              Sân chưa có ảnh — sân có ảnh thường được đặt nhiều hơn.
            </p>
          )}
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Đang lưu...' : submitLabel}
      </Button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function ImageTile({
  src,
  alt,
  onRemove,
}: {
  src: string;
  alt: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative size-24 overflow-hidden rounded-lg bg-muted">
      <Image src={src} alt={alt} fill sizes="96px" className="object-cover" unoptimized />
      <Button
        type="button"
        variant="destructive"
        size="icon-xs"
        aria-label={`Gỡ ảnh ${alt}`}
        className="absolute top-1 right-1 bg-background/90"
        onClick={onRemove}
      >
        <X className="size-3" aria-hidden />
      </Button>
    </div>
  );
}
