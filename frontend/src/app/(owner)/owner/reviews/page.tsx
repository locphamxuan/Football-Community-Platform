'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { MessageSquare, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import StarRating from '@/components/reviews/StarRating';
import reviewService from '@/services/review.service';
import { formatDate } from '@/lib/format';
import type { ApiResponse, OwnerReview } from '@/types';

const PAGE_SIZE = 10;

export default function OwnerReviewsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all' | 'unanswered'>('all');
  const [page, setPage] = useState(1);
  const [replying, setReplying] = useState<OwnerReview | null>(null);
  const [reply, setReply] = useState('');

  const filters = {
    page,
    limit: PAGE_SIZE,
    ...(tab === 'unanswered' ? { unanswered: 'true' as const } : {}),
  };

  const { data, isPending } = useQuery({
    queryKey: ['owner-reviews', filters],
    queryFn: () => reviewService.getOwnerReviews(filters),
  });
  const reviews = data?.data?.data?.reviews ?? [];
  const unanswered = data?.data?.data?.unanswered ?? 0;
  const pagination = data?.data?.meta?.pagination;

  const sendReply = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) => reviewService.ownerReply(id, comment),
    onSuccess: () => {
      toast.success('Đã gửi phản hồi.');
      setReplying(null);
      setReply('');
      qc.invalidateQueries({ queryKey: ['owner-reviews'] });
    },
    onError: (err: AxiosError<ApiResponse<null>>) =>
      toast.error(err.response?.data?.message ?? 'Có lỗi xảy ra'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Đánh giá</h1>
        <p className="text-muted-foreground">
          Chỉ khách đã đá xong ở sân mới đánh giá được — mọi đánh giá ở đây đều đã xác thực
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab((v ?? 'all') as 'all' | 'unanswered');
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="unanswered">Chưa phản hồi ({unanswered})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Star className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold">Chưa có đánh giá nào</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Đánh giá sẽ xuất hiện sau khi khách hoàn thành lượt đặt sân.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r._id}>
              <Card>
                <CardContent className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src={r.user.avatar} alt={r.user.fullName} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {(r.user.fullName || r.user.username || '?').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.user.fullName || r.user.username}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.field?.name} · {formatDate(r.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating value={r.rating} />
                      {r.isVerified && <Badge variant="outline">Đã xác thực</Badge>}
                    </div>
                  </div>

                  {r.comment && <p className="text-sm">{r.comment}</p>}

                  {r.ownerReply?.repliedAt ? (
                    <div className="rounded-lg border-l-2 border-primary bg-muted/40 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Bạn đã phản hồi · {formatDate(r.ownerReply.repliedAt)}
                      </p>
                      <p className="mt-1 text-sm">{r.ownerReply.comment}</p>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplying(r);
                        setReply('');
                      }}
                    >
                      <MessageSquare className="size-4" aria-hidden />
                      Phản hồi
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={!pagination.hasPrevPage} onClick={() => setPage((p) => p - 1)}>
            Trang trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} đánh giá
          </span>
          <Button variant="outline" size="sm" disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>
            Trang sau
          </Button>
        </div>
      )}

      <Dialog open={replying !== null} onOpenChange={(open) => !open && setReplying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phản hồi đánh giá</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Phản hồi hiển thị công khai dưới đánh giá của khách.
            </p>
            <Label htmlFor="owner-reply">Nội dung *</Label>
            <Textarea
              id="owner-reply"
              rows={4}
              maxLength={500}
              placeholder="Cảm ơn bạn đã góp ý, sân sẽ khắc phục..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplying(null)}>
              Quay lại
            </Button>
            <Button
              disabled={reply.trim().length === 0 || sendReply.isPending}
              onClick={() => replying && sendReply.mutate({ id: replying._id, comment: reply.trim() })}
            >
              {sendReply.isPending ? 'Đang gửi...' : 'Gửi phản hồi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
