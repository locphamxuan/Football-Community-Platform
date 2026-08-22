import api from './api';
import type {
  ApiResponse, ChatMessage, Conversation, ConversationContextType, ConversationType,
} from '@/types';

export interface ConversationFilters {
  page?: number;
  limit?: number;
  /** Lọc hộp thư theo tab "Tất cả / Nhóm". */
  type?: ConversationType;
}

export interface MessageFilters {
  page?: number;
  limit?: number;
}

/**
 * Đường HTTP của chat. WebSocket (xem `lib/socket.ts`) là đường đi nhanh cho tin nhắn đang
 * gõ, còn đây là đường tải lịch sử lúc mở màn hình và là đường dự phòng khi kết nối rớt —
 * gửi được tin mà không cần socket là điều kiện để khung chat không chết cùng mạng chập chờn.
 */
const chatService = {
  getConversations: (params?: ConversationFilters) =>
    api.get<ApiResponse<{ conversations: Conversation[]; unreadCount: number }>>(
      '/chat/conversations',
      { params }
    ),

  getConversation: (id: string) =>
    api.get<ApiResponse<{ conversation: Conversation }>>(`/chat/conversations/${id}`),

  /** Mở (hoặc lấy lại) hội thoại tay đôi với một người. */
  openDirect: (recipientId: string) =>
    api.post<ApiResponse<{ conversation: Conversation }>>('/chat/conversations', { recipientId }),

  /**
   * Mở (hoặc lấy lại) hội thoại gắn với một ngữ cảnh — sân, lịch đặt, hay lời mời thi đấu.
   * Backend tự kiểm hai bên có đúng là các bên liên quan tới ngữ cảnh đó không.
   */
  openConversation: (payload: {
    recipientId: string;
    contextType: ConversationContextType;
    contextRef: string;
  }) =>
    api.post<ApiResponse<{ conversation: Conversation }>>('/chat/conversations', payload),

  createGroup: (payload: { name: string; memberIds: string[] }) =>
    api.post<ApiResponse<{ conversation: Conversation }>>('/chat/groups', payload),

  renameGroup: (id: string, name: string) =>
    api.patch<ApiResponse<{ conversation: Conversation }>>(`/chat/conversations/${id}`, { name }),

  addMembers: (id: string, memberIds: string[]) =>
    api.post<ApiResponse<{ conversation: Conversation }>>(`/chat/conversations/${id}/members`, { memberIds }),

  removeMember: (id: string, memberId: string) =>
    api.delete<ApiResponse<{ conversation: Conversation }>>(`/chat/conversations/${id}/members/${memberId}`),

  leaveGroup: (id: string) =>
    api.post<ApiResponse<{ conversationId: string; deleted: boolean }>>(`/chat/conversations/${id}/leave`),

  getMessages: (id: string, params?: MessageFilters) =>
    api.get<ApiResponse<{ messages: ChatMessage[] }>>(`/chat/conversations/${id}/messages`, { params }),

  sendMessage: (id: string, body: string) =>
    api.post<ApiResponse<{ message: ChatMessage }>>(`/chat/conversations/${id}/messages`, { body }),

  markRead: (id: string) =>
    api.post<ApiResponse<{ conversationId: string; readAt: string }>>(`/chat/conversations/${id}/read`),

  getUnreadCount: () => api.get<ApiResponse<{ unreadCount: number }>>('/chat/unread-count'),
};

export default chatService;
