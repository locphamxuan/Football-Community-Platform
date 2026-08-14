'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import userService, { type NotificationPrefsPayload } from '@/services/user.service';
import useAuthStore from '@/stores/authStore';
import { NOTIFICATION_TYPE_LABELS } from '@/lib/constants';
import type { ApiResponse, NotificationType, User } from '@/types';

/**
 * Sự kiện nào sinh ra loại thông báo đó. Nhãn ngắn dùng trong hộp thư ("Lịch đặt mới")
 * không đủ để quyết định tắt hay không — người đọc cần biết chính xác mình sắp bỏ lỡ gì.
 * Thứ tự khai báo cũng là thứ tự hiển thị.
 */
const TYPE_HINTS: Record<NotificationType, string> = {
  booking_created: 'Có người đặt một sân của bạn.',
  booking_confirmed: 'Chủ sân đã xác nhận đơn đặt của bạn.',
  booking_cancelled: 'Một đơn đặt sân bị huỷ.',
  match_request_received: 'Đội khác gửi lời mời thi đấu cho đội bạn.',
  match_request_answered: 'Đội bạn mời đã nhận hoặc từ chối lời mời.',
  match_result_submitted: 'Đối thủ vừa nhập tỉ số, chờ bạn xác nhận.',
  invoice_issued: 'Hoá đơn thuê bao mới cần thanh toán.',
  chat_message: 'Có tin nhắn mới khi bạn không mở ứng dụng.',
};

const TYPES = Object.keys(TYPE_HINTS) as NotificationType[];

const apiError = (err: unknown, fallback: string) =>
  (err as AxiosError<ApiResponse<null>>)?.response?.data?.message ?? fallback;

export default function NotificationPreferences() {
  const qc = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['me'],
    queryFn: () => userService.getMe(),
  });
  const user: User | undefined = data?.data?.data?.user;

  const save = useMutation({
    mutationFn: (prefs: NotificationPrefsPayload) => userService.updateNotificationPrefs(prefs),
    onSuccess: (res) => {
      // Endpoint trả về đúng hình dạng của `getMe`, nên ghi thẳng vào cache: chờ refetch
      // xong mới đổi công tắc khiến nó nảy về chỗ cũ một nhịp rồi mới nhảy sang chỗ mới.
      qc.setQueryData(['me'], res);
      const updated = res.data?.data?.user;
      if (updated) useAuthStore.setState({ user: updated });
      toast.success('Đã lưu tuỳ chọn thông báo');
    },
    onError: (err) => toast.error(apiError(err, 'Không lưu được tuỳ chọn')),
  });

  if (isPending) return <Skeleton className="h-96 rounded-xl" />;

  if (!user) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Không tải được tuỳ chọn thông báo. Vui lòng đăng nhập lại.
        </CardContent>
      </Card>
    );
  }

  const muted = user.notifications?.mutedTypes ?? [];

  const toggleType = (type: NotificationType, enabled: boolean) =>
    save.mutate({
      mutedTypes: enabled ? muted.filter((t) => t !== type) : [...muted, type],
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Thông báo đẩy</CardTitle>
          <CardDescription>
            Áp dụng cho app điện thoại. Tắt thì thông báo vẫn vào hộp thư, chỉ không hiện
            trên màn hình khoá.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <Label htmlFor="push-master" className="font-medium">
              Gửi thông báo tới điện thoại
            </Label>
            <Switch
              id="push-master"
              checked={user.notifications?.push ?? true}
              disabled={save.isPending}
              onCheckedChange={(checked) => save.mutate({ push: Boolean(checked) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loại thông báo</CardTitle>
          <CardDescription>
            Tắt một loại là tắt hẳn: không vào hộp thư, cũng không đẩy tới điện thoại.
            Sự kiện gốc vẫn xem được ở trang lịch đặt, lời mời thi đấu hoặc hoá đơn.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {TYPES.map((type) => (
            <div key={type} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <Label htmlFor={`notif-${type}`} className="font-medium">
                  {NOTIFICATION_TYPE_LABELS[type]}
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">{TYPE_HINTS[type]}</p>
              </div>
              <Switch
                id={`notif-${type}`}
                checked={!muted.includes(type)}
                disabled={save.isPending}
                onCheckedChange={(checked) => toggleType(type, Boolean(checked))}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
