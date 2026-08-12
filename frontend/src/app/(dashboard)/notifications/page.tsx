'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NotificationItem from '@/components/notifications/NotificationItem';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import type { Notification } from '@/types';

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const { data, isLoading } = useNotifications({
    limit: PAGE_SIZE,
    ...(tab === 'unread' ? { unread: 'true' as const } : {}),
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications: Notification[] = data?.data?.data?.notifications ?? [];
  const unreadCount = data?.data?.data?.unreadCount ?? 0;

  const openNotification = (notification: Notification) => {
    if (notification.readAt === null) markRead.mutate(notification._id);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Thông báo</h1>
          <p className="mt-1 text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            Đánh dấu đã đọc hết
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'all' | 'unread')} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="unread">Chưa đọc</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center">
          <Bell className="mx-auto mb-4 size-12 text-muted-foreground" />
          <p className="text-lg font-medium">
            {tab === 'unread' ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo nào'}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-1 p-2">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onOpen={openNotification}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
