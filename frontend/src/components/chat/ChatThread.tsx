'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ChatAvatar from '@/components/chat/ChatAvatar';
import GroupPanel from '@/components/chat/GroupPanel';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageComposer from '@/components/chat/MessageComposer';
import { useConversation, useMarkRead, useMessages, useSendMessage } from '@/hooks/useChat';
import {
  conversationAvatar, conversationTitle, isSeenByOthers, participantsExcept, startsCluster,
} from '@/lib/chat';
import useAuthStore from '@/stores/authStore';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '@/types';

/**
 * Khung hội thoại: đầu trang, dòng thời gian tin nhắn, ô soạn tin.
 *
 * Đánh dấu đã đọc ngay khi mở và mỗi lần có tin mới trong lúc đang mở — người đang nhìn
 * vào tin nhắn thì đã đọc nó rồi, để họ phải bấm thêm một nút "đã đọc" là bắt làm hộ máy.
 */
export default function ChatThread({
  conversationId,
  typingUsers,
  onTyping,
}: {
  conversationId: string;
  typingUsers: string[];
  onTyping: (isTyping: boolean) => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [panelOpen, setPanelOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading: loadingConversation } = useConversation(conversationId);
  const { data: messages, isLoading: loadingMessages } = useMessages(conversationId);
  const sendMessage = useSendMessage(conversationId);
  const markRead = useMarkRead();

  const lastMessageId = messages?.at(-1)?._id;

  useEffect(() => {
    if (!lastMessageId) return;
    markRead.mutate(conversationId);
    // `markRead` là mutation mới mỗi lần render; đưa nó vào deps là gọi lại vô hạn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, lastMessageId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lastMessageId, conversationId]);

  if (loadingConversation || !conversation) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const title = conversationTitle(conversation, userId);
  const isGroup = conversation.type === 'group';
  const others = participantsExcept(conversation, userId);
  const typingNames = others
    .filter((p) => typingUsers.includes(p.user._id))
    .map((p) => p.user.fullName);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b p-3">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          className="cursor-pointer md:hidden"
          aria-label="Về danh sách tin nhắn"
          render={<Link href="/chat" />}
        >
          <ArrowLeft />
        </Button>

        <ChatAvatar
          name={title}
          src={conversationAvatar(conversation, userId)}
          isGroup={isGroup}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {isGroup
              ? `${conversation.participants.length} thành viên`
              : `@${others[0]?.user.username ?? ''}`}
          </p>
        </div>

        {isGroup && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Thông tin nhóm"
            onClick={() => setPanelOpen(true)}
          >
            <Info />
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loadingMessages ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : !messages?.length ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên.
          </p>
        ) : (
          <ul className="space-y-1">
            {messages.map((message, index) => {
              const isMine = message.sender?._id === userId;
              const isLastOfMine = isMine && !messages.slice(index + 1).some((m) => m.sender?._id === userId);

              return (
                <MessageBubble
                  key={message._id}
                  message={message}
                  isMine={isMine}
                  startsCluster={startsCluster(message, messages[index - 1])}
                  showSender={isGroup}
                  seenLabel={
                    isLastOfMine && isSeenByOthers(conversation, message, userId) ? 'Đã xem' : undefined
                  }
                />
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {typingNames.length > 0 && (
        <p className="px-4 pb-1 text-xs text-muted-foreground" aria-live="polite">
          {typingNames.join(', ')} đang nhập…
        </p>
      )}

      <MessageComposer
        disabled={sendMessage.isPending}
        onTyping={onTyping}
        onSend={(body) =>
          sendMessage.mutate(body, {
            onError: (err) =>
              toast.error(
                (err as AxiosError<ApiResponse<null>>)?.response?.data?.message ?? 'Không gửi được tin nhắn'
              ),
          })
        }
      />

      {isGroup && (
        <GroupPanel conversation={conversation} open={panelOpen} onClose={() => setPanelOpen(false)} />
      )}
    </div>
  );
}
