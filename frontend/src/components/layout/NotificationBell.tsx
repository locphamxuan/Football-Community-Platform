'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotificationItem from '@/components/notifications/NotificationItem';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import type { Notification } from '@/types';

const PREVIEW_LIMIT = 6;

export default function NotificationBell() {
  const { data, isLoading } = useNotifications({ limit: PREVIEW_LIMIT });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications: Notification[] = data?.data?.data?.notifications ?? [];
  const unreadCount = data?.data?.data?.unreadCount ?? 0;

  const openNotification = (notification: Notification) => {
    if (notification.readAt === null) markRead.mutate(notification._id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative cursor-pointer"
            aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
          />
        }
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-semibold">Thông báo</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Đánh dấu đã đọc hết
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />

        <div className="max-h-96 overflow-y-auto p-1">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Đang tải…</p>
          ) : notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Chưa có thông báo nào
            </p>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onOpen={openNotification}
              />
            ))
          )}
        </div>

        <DropdownMenuSeparator className="my-0" />
        <Link
          href="/notifications"
          className="block px-3 py-2 text-center text-sm font-medium text-primary hover:underline"
        >
          Xem tất cả
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
