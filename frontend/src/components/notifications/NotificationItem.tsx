'use client';

import Link from 'next/link';
import { CalendarCheck, CalendarPlus, CalendarX, MessageSquare, Receipt, Swords, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';
import { NOTIFICATION_TYPE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types';

const ICONS: Record<NotificationType, LucideIcon> = {
  booking_created: CalendarPlus,
  booking_confirmed: CalendarCheck,
  booking_cancelled: CalendarX,
  match_request_received: Swords,
  match_request_answered: Swords,
  match_result_submitted: Trophy,
  invoice_issued: Receipt,
  chat_message: MessageSquare,
};

interface Props {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}

/**
 * Một dòng thông báo. Bấm vào là vừa đánh dấu đã đọc vừa mở đối tượng liên quan —
 * hai thao tác tách rời chỉ khiến hộp thư đầy thông báo chưa đọc đã xem rồi.
 */
export default function NotificationItem({ notification, onOpen }: Props) {
  const Icon = ICONS[notification.type];
  const isUnread = notification.readAt === null;

  const content = (
    <>
      <span
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
          isUnread ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        )}
      >
        {Icon ? <Icon className="size-4" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate', isUnread ? 'font-semibold' : 'font-medium')}>
          {notification.title}
        </span>
        {notification.body && (
          <span className="mt-0.5 block text-sm text-muted-foreground">{notification.body}</span>
        )}
        <span className="mt-1 block text-xs text-muted-foreground">
          {NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type}
          {' · '}
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>
      {isUnread && (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Chưa đọc" />
      )}
    </>
  );

  const className = cn(
    'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent/60',
    isUnread && 'bg-accent/30'
  );

  if (notification.link) {
    return (
      <Link href={notification.link} className={className} onClick={() => onOpen(notification)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={() => onOpen(notification)}>
      {content}
    </button>
  );
}
