import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import type { ChatMessage, NewMessageEvent, TypingEvent } from '@fcp/shared';
import { API_URL } from './api';
import { getAccessToken } from './session';

/**
 * Kết nối WebSocket tới backend — một cái cho cả app.
 *
 * Socket.io gắn vào chính server đang phục vụ REST, nên địa chỉ là `API_URL` bỏ phần
 * tiền tố phiên bản: `http://host/api/v1` → `http://host`.
 */
const SOCKET_URL = API_URL.replace(/\/api\/v\d+\/?$/, '');

let socket: Socket | null = null;

/**
 * `auth` là **hàm** chứ không phải object: server xác thực một lần lúc bắt tay, còn access
 * token chỉ sống 15 phút và được `authFetch` lặng lẽ làm mới. Chốt cứng token lúc mở kết nối
 * nghĩa là mọi lần kết nối lại sau đó đều mang theo một token đã chết — mà app di động thì
 * mất mạng và kết nối lại suốt.
 */
export const getChatSocket = (): Socket => {
  socket ??= io(SOCKET_URL, {
    auth: (cb) => cb({ token: getAccessToken() ?? '' }),
    // React Native không có XHR streaming đủ tin cậy cho long-polling của socket.io;
    // đi thẳng WebSocket tránh hẳn giai đoạn nâng cấp giao thức.
    transports: ['websocket'],
  });
  return socket;
};

export const closeChatSocket = () => {
  socket?.disconnect();
  socket = null;
};

export const chatKeys = {
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
  unread: ['chat', 'unread'] as const,
};

/** "Đang nhập…" tự tắt sau ngần này nếu người kia ngừng gõ mà không kịp báo. */
const TYPING_TIMEOUT_MS = 4000;

/**
 * Bật realtime cho màn hình chat đang mở.
 *
 * Mọi sự kiện đổ về cache của react-query để giao diện chỉ có **một** nguồn dữ liệu, thay vì
 * một bản trong state màn hình và một bản trong cache — hai bản luôn có ngày lệch nhau.
 */
export const useChatRealtime = (activeConversationId?: string) => {
  const queryClient = useQueryClient();
  const [typing, setTyping] = useState<{ conversationId?: string; userIds: string[] }>({ userIds: [] });

  useEffect(() => {
    const chat = getChatSocket();
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};

    const refreshInbox = () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
      queryClient.invalidateQueries({ queryKey: chatKeys.unread });
    };

    const onNewMessage = ({ conversationId, message }: NewMessageEvent) => {
      queryClient.setQueryData<ChatMessage[]>(chatKeys.messages(conversationId), (old) => {
        if (!old) return old;
        // Người gửi nhận lại chính tin của mình (họ có thể mở cả web lẫn điện thoại);
        // thêm hai lần thì khung chat hiện tin đôi.
        return old.some((m) => m._id === message._id) ? old : [message, ...old];
      });
      refreshInbox();
    };

    const onConversationUpdated = () => {
      if (activeConversationId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.conversation(activeConversationId) });
      }
      refreshInbox();
    };

    const update = (conversationId: string, change: (users: string[]) => string[]) =>
      setTyping((current) => ({
        conversationId,
        userIds: change(current.conversationId === conversationId ? current.userIds : []),
      }));

    const onTyping = ({ conversationId, userId, isTyping }: TypingEvent) => {
      if (conversationId !== activeConversationId) return;

      clearTimeout(timers[userId]);
      if (!isTyping) {
        update(conversationId, (users) => users.filter((id) => id !== userId));
        return;
      }

      update(conversationId, (users) => (users.includes(userId) ? users : [...users, userId]));
      timers[userId] = setTimeout(
        () => update(conversationId, (users) => users.filter((id) => id !== userId)),
        TYPING_TIMEOUT_MS
      );
    };

    chat.on('message:new', onNewMessage);
    chat.on('conversation:updated', onConversationUpdated);
    // "Đã xem" nằm trong `participants.lastReadAt` của hội thoại nên chỉ cần tải lại nó.
    chat.on('conversation:read', onConversationUpdated);
    chat.on('conversation:typing', onTyping);

    return () => {
      chat.off('message:new', onNewMessage);
      chat.off('conversation:updated', onConversationUpdated);
      chat.off('conversation:read', onConversationUpdated);
      chat.off('conversation:typing', onTyping);
      Object.values(timers).forEach(clearTimeout);
    };
  }, [queryClient, activeConversationId]);

  const notifyTyping = (isTyping: boolean) => {
    if (!activeConversationId) return;
    getChatSocket().emit('conversation:typing', { conversationId: activeConversationId, isTyping });
  };

  return {
    // Danh sách của hội thoại khác thì coi như không có ai đang gõ.
    typingUsers: typing.conversationId === activeConversationId ? typing.userIds : [],
    notifyTyping,
  };
};
