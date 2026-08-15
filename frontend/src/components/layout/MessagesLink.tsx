'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatUnreadCount } from '@/hooks/useChat';

/**
 * Lối vào khu chat kèm chấm đỏ, đứng cạnh chuông thông báo.
 *
 * Chỉ dựng khi tài khoản thật sự dùng được chat — quản trị viên nền tảng đứng ngoài, và
 * một nút dẫn tới màn hình từ chối truy cập thì thà không có.
 */
export default function MessagesLink() {
  const { data: unreadCount = 0 } = useChatUnreadCount();

  return (
    <Button
      variant="ghost"
      size="icon"
      nativeButton={false}
      className="relative cursor-pointer"
      aria-label={unreadCount > 0 ? `Tin nhắn, ${unreadCount} chưa đọc` : 'Tin nhắn'}
      render={<Link href="/chat" />}
    >
      <MessageCircle className="size-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
