'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import fieldService from '@/services/field.service';
import reviewService from '@/services/review.service';
import useAuthStore from '@/stores/authStore';
import { formatPrice } from '@/lib/format';
import type { Review } from '@/types';
import { toast } from 'sonner';
import { Star, MapPin, Clock, Phone, CheckCircle, Car, Droplets, Utensils, Wifi, ThumbsUp, MessageSquare, Volleyball } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  parking: <Car className="h-4 w-4" />,
  shower: <Droplets className="h-4 w-4" />,
  cafeteria: <Utensils className="h-4 w-4" />,
  wifi: <Wifi className="h-4 w-4" />,
};

const AMENITY_LABELS: Record<string, string> = {
  parking: 'Bãi đỗ xe',
  shower: 'Phòng tắm',
  cafeteria: 'Căng-tin',
  changing_room: 'Phòng thay đồ',
  wifi: 'Wifi',
  lighting: 'Đèn chiếu sáng',
  tribunes: 'Khán đài',
};

const SURFACE_LABELS: Record<string, string> = {
  natural_grass: 'Cỏ tự nhiên',
  artificial_grass: 'Cỏ nhân tạo',
  concrete: 'Sân xi-măng',
};

export default function FieldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['field', id],
    queryFn: () => fieldService.getFieldById(id),
  });

  const field = data?.data?.data?.field;

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => reviewService.getFieldReviews(id, { limit: 10 }),
    enabled: !!id,
  });
  const reviews: Review[] = reviewsData?.data?.data?.reviews ?? [];

  const createReviewMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('fieldId', id);
      fd.append('rating', String(reviewRating));
      fd.append('comment', reviewComment);
      return reviewService.create(fd);
    },
    onSuccess: () => {
      toast.success('Đánh giá của bạn đã được ghi nhận!');
      setReviewComment('');
      setReviewRating(5);
      qc.invalidateQueries({ queryKey: ['reviews', id] });
      qc.invalidateQueries({ queryKey: ['field', id] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Có lỗi xảy ra';
      toast.error(msg);
    },
  });

  const likeMutation = useMutation({
    mutationFn: (reviewId: string) => reviewService.toggleLike(reviewId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews', id] }),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-80 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!field) return <div className="container mx-auto px-4 py-8 text-center">Không tìm thấy sân.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Image gallery */}
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-80 rounded-xl overflow-hidden mb-8">
        {field.images.slice(0, 5).map((img, i) => (
          <div
            key={i}
            className={`relative ${i === 0 ? 'col-span-2 row-span-2' : ''} bg-gray-100`}
          >
            <Image src={img} alt={`${field.name} ${i + 1}`} fill className="object-cover" />
          </div>
        ))}
        {field.images.length === 0 && (
          <div className="col-span-4 row-span-2 flex items-center justify-center bg-primary/5">
            <Volleyball className="size-16 text-primary/40" aria-hidden />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left: Info ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold">{field.name}</h1>
              {field.isVerified && (
                <Badge className="bg-blue-600 text-white shrink-0">
                  <CheckCircle className="h-3 w-3 mr-1" /> Đã xác minh
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <div className="flex items-center gap-1 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{field.location.address}, {field.location.district}, {field.location.city}</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <span className="font-medium">{field.rating.average.toFixed(1)}</span>
                <span className="text-muted-foreground text-sm">({field.rating.count} đánh giá)</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Operating hours */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span>Giờ hoạt động: <strong>{field.operatingHours.open} – {field.operatingHours.close}</strong></span>
          </div>

          {/* Sub-fields */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Các sân</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field.subFields.map((sf) => (
                <div
                  key={sf._id}
                  className={`border rounded-lg p-3 ${sf.status === 'available' ? 'border-primary/30 bg-primary/5' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{sf.name}</span>
                    <Badge variant={sf.status === 'available' ? 'default' : 'secondary'}
                      className={sf.status === 'available' ? 'bg-primary' : ''}>
                      {sf.status === 'available' ? 'Sẵn sàng' : sf.status === 'maintenance' ? 'Bảo trì' : 'Đóng cửa'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {sf.fieldType} · {SURFACE_LABELS[sf.surface] ?? sf.surface}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Amenities */}
          {field.amenities.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Tiện ích</h2>
              <div className="flex flex-wrap gap-2">
                {field.amenities.map((a) => (
                  <Badge key={a} variant="outline" className="gap-1 py-1">
                    {AMENITY_ICONS[a]}
                    {AMENITY_LABELS[a] ?? a}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {field.description && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Mô tả</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">{field.description}</p>
            </div>
          )}

          {/* Rules */}
          {field.rules.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Nội quy</h2>
              <ul className="space-y-1">
                {field.rules.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reviews */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Đánh giá ({field.rating.count})
            </h2>

            {/* Write review */}
            {isAuthenticated && (
              <Card className="mb-6">
                <CardContent className="pt-5 space-y-3">
                  <p className="text-sm font-medium">Viết đánh giá của bạn</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} type="button" onClick={() => setReviewRating(s)}>
                        <Star className={`h-6 w-6 transition-colors ${s <= reviewRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Chia sẻ trải nghiệm của bạn về sân này..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                  />
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                    disabled={createReviewMutation.isPending}
                    onClick={() => createReviewMutation.mutate()}
                  >
                    {createReviewMutation.isPending ? 'Đang gửi...' : 'Gửi đánh giá'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Review list */}
            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review._id} className="border-b pb-4 last:border-0">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={review.user.avatar} />
                        <AvatarFallback>{review.user.fullName?.charAt(0) ?? '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{review.user.fullName}</span>
                          {review.isVerified && <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Đã đặt sân</Badge>}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(review.createdAt), 'dd/MM/yyyy', { locale: vi })}
                          </span>
                        </div>
                        <div className="flex gap-0.5 my-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`h-3.5 w-3.5 ${s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                        {review.comment && <p className="text-sm text-gray-700">{review.comment}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => isAuthenticated && likeMutation.mutate(review._id)}
                          >
                            <ThumbsUp className="h-3 w-3" />
                            {review.likes.length > 0 && review.likes.length}
                          </button>
                        </div>
                        {review.ownerReply?.comment && (
                          <div className="mt-2 ml-4 p-2 rounded bg-primary/5 border-l-2 border-primary/60">
                            <p className="text-xs font-medium text-primary">Phản hồi của chủ sân:</p>
                            <p className="text-xs text-gray-700 mt-0.5">{review.ownerReply.comment}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Booking card ────────────────────────────────── */}
        <div className="space-y-4">
          {/* Price card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bảng giá</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Weekday */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Ngày thường</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Buổi sáng (6h–12h)</span>
                    <span className="font-medium text-primary">{formatPrice(field.pricing.weekday.morning)}/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buổi chiều (12h–18h)</span>
                    <span className="font-medium text-primary">{formatPrice(field.pricing.weekday.afternoon)}/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buổi tối (18h–23h)</span>
                    <span className="font-medium text-primary">{formatPrice(field.pricing.weekday.evening)}/h</span>
                  </div>
                </div>
              </div>
              <Separator />
              {/* Weekend */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Cuối tuần</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Buổi sáng</span>
                    <span className="font-medium text-primary">{formatPrice(field.pricing.weekend.morning)}/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buổi chiều</span>
                    <span className="font-medium text-primary">{formatPrice(field.pricing.weekend.afternoon)}/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buổi tối</span>
                    <span className="font-medium text-primary">{formatPrice(field.pricing.weekend.evening)}/h</span>
                  </div>
                </div>
              </div>
              <Link href={`/bookings/create?fieldId=${field._id}`}>
                <Button className="w-full bg-primary hover:bg-primary/90 mt-2">
                  Đặt sân ngay
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Owner card */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-medium mb-2">Chủ sân</p>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {field.owner.fullName?.[0] ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-medium">{field.owner.fullName}</p>
                  {field.owner.phone && (
                    <a href={`tel:${field.owner.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      <Phone className="h-3 w-3" /> {field.owner.phone}
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
