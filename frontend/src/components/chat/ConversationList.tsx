'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquarePlus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import ChatAvatar from '@/components/chat/ChatAvatar';
import NewChatDialog from '@/components/chat/NewChatDialog';
import { useConversations } from '@/hooks/useChat';
import { conversationAvatar, conversationTitle, previewOf, unreadOf } from '@/lib/chat';
import { formatRelativeTime } from '@/lib/format';
import useAuthStore from '@/stores/authStore';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types';

const PAGE_SIZE = 50;

/**
 * Hộp thư. Ô tìm kiếm lọc ngay trên danh sách đã tải chứ không gọi thêm API: người dùng
 * tìm cuộc trò chuyện họ vừa nói chuyện hôm qua, và nó nằm sẵn trong trang đầu tiên.
 */
export default function ConversationList({ activeId }: { activeId?: string }) {
  const [term, setTerm] = useState('');
  const [creating, setCreating] = useState<'direct' | 'group' | null>(null);
  const userId = useAuthStore((s) => s.user?.id);
  const { data, isLoading } = useConversations({ limit: PAGE_SIZE });

  const conversations = data?.conversations ?? [];
  const visible = term.trim()
    ? conversations.filter((c) =>
        conversationTitle(c, userId).toLowerCase().includes(term.trim().toLowerCase()))
    : conversations;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold">Tin nhắn</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Nhắn tin mới"
              onClick={() => setCreating('direct')}
            >
              <MessageSquarePlus />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Tạo nhóm chat"
              onClick={() => setCreating('group')}
            >
              <Users />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Tìm cuộc trò chuyện"
            aria-label="Tìm cuộc trò chuyện"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {term ? 'Không tìm thấy cuộc trò chuyện nào' : 'Chưa có cuộc trò chuyện nào. Bắt đầu bằng nút ở trên.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {visible.map((conversation) => (
              <ConversationRow
                key={conversation._id}
                conversation={conversation}
                userId={userId}
                isActive={conversation._id === activeId}
              />
            ))}
          </ul>
        )}
      </div>

      <NewChatDialog mode={creating} onClose={() => setCreating(null)} />
    </div>
  );
}

function ConversationRow({
  conversation,
  userId,
  isActive,
}: {
  conversation: Conversation;
  userId?: string;
  isActive: boolean;
}) {
  const title = conversationTitle(conversation, userId);
  const unread = unreadOf(conversation, userId);

  return (
    <li>
      <Link
        href={`/chat/${conversation._id}`}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-xl px-2 py-2 transition-colors',
          isActive ? 'bg-accent' : 'hover:bg-accent/60'
        )}
      >
        <ChatAvatar
          name={title}
          src={conversationAvatar(conversation, userId)}
          isGroup={conversation.type === 'group'}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn('truncate text-sm', unread > 0 ? 'font-bold' : 'font-medium')}>{title}</p>
            {conversation.lastMessage?.sentAt && (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatRelativeTime(conversation.lastMessage.sentAt)}
              </span>
            )}
          </div>
          <p className={cn('truncate text-xs', unread > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
            {previewOf(conversation, userId)}
          </p>
        </div>
        {unread > 0 && (
          <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>
    </li>
  );
}
