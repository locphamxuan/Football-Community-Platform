import type {
  ChatMessage, ChatParticipantProfile, Conversation, ConversationContextType, ConversationType,
} from '@fcp/shared';
import { authFetch } from '../lib/authFetch';
import { toQueryString } from './field.service';

/**
 * Đường HTTP của chat. WebSocket (xem `lib/chatSocket.ts`) là đường đi nhanh cho tin nhắn
 * đang gõ, còn đây là đường tải lịch sử lúc mở màn hình và là đường dự phòng khi kết nối rớt —
 * trên điện thoại, mạng rớt là chuyện thường chứ không phải ngoại lệ.
 */
export const chatService = {
  conversations: (params: { limit?: number; type?: ConversationType } = {}) =>
    authFetch<{ conversations: Conversation[]; unreadCount: number }>(
      `/chat/conversations${toQueryString(params)}`
    ),

  conversation: (id: string) =>
    authFetch<{ conversation: Conversation }>(`/chat/conversations/${id}`),

  unreadCount: () => authFetch<{ unreadCount: number }>('/chat/unread-count'),

  messages: (id: string, params: { limit?: number } = {}) =>
    authFetch<{ messages: ChatMessage[] }>(
      `/chat/conversations/${id}/messages${toQueryString(params)}`
    ),

  send: (id: string, body: string) =>
    authFetch<{ message: ChatMessage }>(`/chat/conversations/${id}/messages`, {
      method: 'POST',
      body: { body },
    }),

  markRead: (id: string) =>
    authFetch<{ conversationId: string; readAt: string }>(`/chat/conversations/${id}/read`, {
      method: 'POST',
    }),

  openDirect: (recipientId: string) =>
    authFetch<{ conversation: Conversation }>('/chat/conversations', {
      method: 'POST',
      body: { recipientId },
    }),

  /**
   * Mở (hoặc lấy lại) hội thoại gắn với một ngữ cảnh — sân, lịch đặt, hay lời mời thi đấu.
   * Backend tự kiểm hai bên có đúng là các bên liên quan tới ngữ cảnh đó không.
   */
  openConversation: (payload: {
    recipientId: string;
    contextType: ConversationContextType;
    contextRef: string;
  }) =>
    authFetch<{ conversation: Conversation }>('/chat/conversations', {
      method: 'POST',
      body: payload,
    }),

  createGroup: (payload: { name: string; memberIds: string[] }) =>
    authFetch<{ conversation: Conversation }>('/chat/groups', { method: 'POST', body: payload }),

  renameGroup: (id: string, name: string) =>
    authFetch<{ conversation: Conversation }>(`/chat/conversations/${id}`, {
      method: 'PATCH',
      body: { name },
    }),

  addMembers: (id: string, memberIds: string[]) =>
    authFetch<{ conversation: Conversation }>(`/chat/conversations/${id}/members`, {
      method: 'POST',
      body: { memberIds },
    }),

  removeMember: (id: string, memberId: string) =>
    authFetch<{ conversation: Conversation }>(`/chat/conversations/${id}/members/${memberId}`, {
      method: 'DELETE',
    }),

  leaveGroup: (id: string) =>
    authFetch<{ conversationId: string; deleted: boolean }>(`/chat/conversations/${id}/leave`, {
      method: 'POST',
    }),

  /** Tìm người để nhắn tin hoặc mời vào nhóm; backend đã loại sẵn admin và tài khoản bị khoá. */
  searchUsers: (q: string) =>
    authFetch<{ users: ChatParticipantProfile[] }>(`/users/search${toQueryString({ q })}`),
};
