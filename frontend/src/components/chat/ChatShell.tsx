'use client';

import { MessagesSquare } from 'lucide-react';
import ChatThread from '@/components/chat/ChatThread';
import ConversationList from '@/components/chat/ConversationList';
import { useChatSocket } from '@/hooks/useChat';
import { cn } from '@/lib/utils';

/**
 * Bố cục kiểu Facebook: danh sách bên trái, hội thoại bên phải.
 *
 * Trên màn hình hẹp, hai nửa thay phiên chiếm cả màn hình — `/chat` là hộp thư, còn
 * `/chat/<id>` là khung chat, nên nút back của trình duyệt cũng là nút "về hộp thư".
 * Kết nối WebSocket mở ở đây, chỗ duy nhất bọc cả hai nửa, nên chỉ có một kết nối cho
 * cả khu chat dù người dùng đi lại giữa các hội thoại.
 */
export default function ChatShell({ conversationId }: { conversationId?: string }) {
  const { typingUsers, notifyTyping } = useChatSocket(conversationId);

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-7xl border-x">
      <aside
        className={cn(
          'w-full shrink-0 border-r md:w-80 lg:w-96',
          conversationId && 'hidden md:block'
        )}
      >
        <ConversationList activeId={conversationId} />
      </aside>

      <section className={cn('min-w-0 flex-1', !conversationId && 'hidden md:block')}>
        {conversationId ? (
          <ChatThread
            conversationId={conversationId}
            typingUsers={typingUsers}
            onTyping={notifyTyping}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <MessagesSquare className="size-10 text-muted-foreground" aria-hidden />
            <p className="font-medium">Chọn một cuộc trò chuyện</p>
            <p className="text-sm text-muted-foreground">
              Hoặc bắt đầu cuộc trò chuyện mới với bạn bè, chủ sân và đồng đội của bạn.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
