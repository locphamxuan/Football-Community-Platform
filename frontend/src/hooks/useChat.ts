'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import chatService, { type ConversationFilters } from '@/services/chat.service';
import { getChatSocket } from '@/lib/socket';
import type {
  ChatMessage, Conversation, ConversationUpdatedEvent, NewMessageEvent, TypingEvent,
} from '@/types';

export const CHAT_KEY = ['chat'];
const conversationsKey = (filters?: ConversationFilters) => [...CHAT_KEY, 'conversations', filters ?? {}];
const conversationKey = (id: string) => [...CHAT_KEY, 'conversation', id];
const messagesKey = (id: string) => [...CHAT_KEY, 'messages', id];
const unreadKey = [...CHAT_KEY, 'unread'];

/**
 * Chấm đỏ ở thanh điều hướng hỏi lại mỗi phút, giống chuông thông báo: một kết nối
 * WebSocket chỉ để đếm là quá đắt cho mọi trang của trang web. Khi mở khung chat thì
 * `useChatSocket` mới bật realtime, và nó cũng làm mới đúng con số này.
 */
const UNREAD_POLL_MS = 60_000;

/** Lịch sử tải một lần chừng này tin; đủ cho một khung chat mở ra là thấy ngay mạch chuyện. */
const MESSAGE_PAGE_SIZE = 50;

/**
 * Hook chat mở gói `data` ngay trong `queryFn`, khác các hook cũ (trả nguyên response axios).
 * Cache của chat bị **ghi thẳng** khi có tin nhắn đến qua WebSocket, và ghi vào một
 * `AxiosResponse` lồng ba tầng là cách chắc chắn để một ngày nào đó ghi nhầm tầng.
 */

export const useConversations = (filters?: ConversationFilters) =>
  useQuery({
    queryKey: conversationsKey(filters),
    queryFn: async () => (await chatService.getConversations(filters)).data.data,
  });

export const useConversation = (id?: string) =>
  useQuery({
    queryKey: conversationKey(id ?? ''),
    queryFn: async () => (await chatService.getConversation(id!)).data.data.conversation,
    enabled: Boolean(id),
  });

export const useMessages = (id?: string) =>
  useQuery({
    queryKey: messagesKey(id ?? ''),
    // Backend trả tin mới nhất trước (phân trang đi lùi); khung chat đọc xuôi thời gian.
    queryFn: async () => {
      const { messages } = (await chatService.getMessages(id!, { limit: MESSAGE_PAGE_SIZE })).data.data;
      return [...messages].reverse();
    },
    enabled: Boolean(id),
  });

export const useChatUnreadCount = (enabled = true) =>
  useQuery({
    queryKey: unreadKey,
    queryFn: async () => (await chatService.getUnreadCount()).data.data.unreadCount,
    refetchInterval: UNREAD_POLL_MS,
    enabled,
  });

/** Sau mọi thay đổi: hộp thư và chấm đỏ phải vẽ lại, chi tiết hội thoại thì tuỳ chỗ gọi. */
const useChatInvalidator = () => {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: [...CHAT_KEY, 'conversations'] });
    qc.invalidateQueries({ queryKey: unreadKey });
  }, [qc]);
};

export const useSendMessage = (conversationId: string) => {
  const invalidate = useChatInvalidator();

  return useMutation({
    // Gửi bằng HTTP chứ không bằng socket: tin nhắn phải đi được cả khi realtime đang rớt,
    // và server đẩy lại sự kiện `message:new` nên màn hình vẫn cập nhật đúng một đường.
    mutationFn: (body: string) => chatService.sendMessage(conversationId, body),
    onSuccess: invalidate,
  });
};

export const useMarkRead = () => {
  const invalidate = useChatInvalidator();

  return useMutation({
    mutationFn: (conversationId: string) => chatService.markRead(conversationId),
    onSuccess: invalidate,
  });
};

export const useOpenDirect = () => {
  const invalidate = useChatInvalidator();

  return useMutation({
    mutationFn: (recipientId: string) => chatService.openDirect(recipientId),
    onSuccess: invalidate,
  });
};

export const useCreateGroup = () => {
  const invalidate = useChatInvalidator();

  return useMutation({
    mutationFn: (payload: { name: string; memberIds: string[] }) => chatService.createGroup(payload),
    onSuccess: invalidate,
  });
};

/** Đổi tên, thêm và gỡ thành viên — cùng một hậu quả: hội thoại này và hộp thư phải vẽ lại. */
const useGroupMutation = <TArgs>(
  request: (args: TArgs) => Promise<{ data: { data: { conversation: Conversation } } }>,
  conversationId: string
) => {
  const qc = useQueryClient();
  const invalidate = useChatInvalidator();

  return useMutation({
    mutationFn: request,
    onSuccess: (res) => {
      qc.setQueryData(conversationKey(conversationId), res.data.data.conversation);
      invalidate();
    },
  });
};

export const useRenameGroup = (conversationId: string) =>
  useGroupMutation((name: string) => chatService.renameGroup(conversationId, name), conversationId);

export const useAddMembers = (conversationId: string) =>
  useGroupMutation(
    (memberIds: string[]) => chatService.addMembers(conversationId, memberIds),
    conversationId
  );

export const useRemoveMember = (conversationId: string) =>
  useGroupMutation(
    (memberId: string) => chatService.removeMember(conversationId, memberId),
    conversationId
  );

export const useLeaveGroup = () => {
  const invalidate = useChatInvalidator();

  return useMutation({
    mutationFn: (conversationId: string) => chatService.leaveGroup(conversationId),
    onSuccess: invalidate,
  });
};

/** "Đang nhập…" tự tắt sau ngần này nếu người kia ngừng gõ mà không kịp báo. */
const TYPING_TIMEOUT_MS = 4000;

/**
 * Bật realtime cho khung chat đang mở.
 *
 * Trả về ai đang gõ trong hội thoại này, và cách báo cho người khác biết mình đang gõ.
 * Mọi sự kiện đều đổ về cache của react-query để chỉ có **một** nguồn dữ liệu cho giao diện,
 * thay vì một bản sao trong state của component và một bản trong cache — hai bản luôn lệch.
 */
export const useChatSocket = (activeConversationId?: string) => {
  const qc = useQueryClient();
  const invalidate = useChatInvalidator();
  // Ai đang gõ, **trong hội thoại nào**. Gắn kèm id hội thoại thay vì xoá danh sách mỗi lần
  // chuyển màn hình: một effect chỉ để dọn state là một vòng render thừa và một chỗ để quên.
  const [typing, setTyping] = useState<{ conversationId?: string; userIds: string[] }>({ userIds: [] });
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const socket = getChatSocket();
    const timers = typingTimers.current;

    const onNewMessage = ({ conversationId, message }: NewMessageEvent) => {
      qc.setQueryData<ChatMessage[]>(messagesKey(conversationId), (old) => {
        if (!old) return old;
        // Người gửi nhận lại chính tin của mình (họ có thể đang mở hai thiết bị) — thêm hai
        // lần thì khung chat hiện tin đôi.
        return old.some((m) => m._id === message._id) ? old : [...old, message];
      });
      invalidate();
    };

    const onConversationUpdated = ({ conversation }: ConversationUpdatedEvent) => {
      qc.setQueryData(conversationKey(conversation._id), conversation);
      invalidate();
    };

    // "Đã xem" nằm trong `participants.lastReadAt` của hội thoại, nên chỉ cần tải lại nó.
    const onRead = () => invalidate();

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
      timers[userId] = setTimeout(() => {
        update(conversationId, (users) => users.filter((id) => id !== userId));
      }, TYPING_TIMEOUT_MS);
    };

    socket.on('message:new', onNewMessage);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('conversation:read', onRead);
    socket.on('conversation:typing', onTyping);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('conversation:read', onRead);
      socket.off('conversation:typing', onTyping);
      Object.values(timers).forEach(clearTimeout);
    };
  }, [qc, invalidate, activeConversationId]);

  const notifyTyping = useCallback((isTyping: boolean) => {
    if (!activeConversationId) return;
    getChatSocket().emit('conversation:typing', { conversationId: activeConversationId, isTyping });
  }, [activeConversationId]);

  return {
    // Danh sách của hội thoại khác thì coi như không có ai đang gõ.
    typingUsers: typing.conversationId === activeConversationId ? typing.userIds : [],
    notifyTyping,
  };
};
