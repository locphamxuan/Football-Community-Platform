import type { ChatMessage, Conversation, ConversationParticipant } from '@fcp/shared';

/**
 * Những câu hỏi mà mọi màn hình chat đều hỏi: hội thoại này tên gì, mình còn bao nhiêu tin
 * chưa đọc, mình có quyền sửa nhóm không.
 *
 * Hàm thuần, tách khỏi màn hình, vì cùng một câu trả lời phải giống nhau ở hộp thư và ở
 * đầu khung chat. Web có bản riêng (`frontend/src/lib/chat.ts`): `@fcp/shared` chỉ chứa
 * type, không mang được giá trị runtime nào sang cả hai phía.
 */

export const participantsExcept = (conversation: Conversation, userId?: string) =>
  conversation.participants.filter((p) => p.user._id !== userId);

/** Nhóm lấy tên nhóm, tay đôi lấy tên người kia — và luôn phải ra một cái tên đọc được. */
export const conversationTitle = (conversation: Conversation, userId?: string) => {
  if (conversation.type === 'group') return conversation.name || 'Nhóm chat';

  const other = participantsExcept(conversation, userId)[0];
  return other?.user.fullName || other?.user.username || 'Người dùng';
};

export const myParticipation = (
  conversation: Conversation,
  userId?: string
): ConversationParticipant | undefined =>
  conversation.participants.find((p) => p.user._id === userId);

export const unreadOf = (conversation: Conversation, userId?: string) =>
  myParticipation(conversation, userId)?.unreadCount ?? 0;

/** Chỉ quản trị nhóm mới được thêm, gỡ thành viên và đổi tên (luật ở backend). */
export const isGroupAdmin = (conversation: Conversation, userId?: string) =>
  conversation.type === 'group' && myParticipation(conversation, userId)?.role === 'admin';

/** Dòng xem trước trong hộp thư: "Bạn: ..." khi tin cuối là của mình. */
export const previewOf = (conversation: Conversation, userId?: string) => {
  const last = conversation.lastMessage;
  if (!last?.body) return 'Chưa có tin nhắn nào';
  return last.sender === userId ? `Bạn: ${last.body}` : last.body;
};

/**
 * Tin nhắn cuối của mình đã có ai đọc chưa — để hiện "Đã xem".
 *
 * Trạng thái đọc là một mốc thời gian mỗi người: "đã xem" nghĩa là có ít nhất một người
 * khác đọc tới sau lúc tin này được gửi.
 */
export const isSeenByOthers = (
  conversation: Conversation,
  message: ChatMessage,
  userId?: string
) =>
  participantsExcept(conversation, userId).some(
    (p) => p.lastReadAt !== null && new Date(p.lastReadAt) >= new Date(message.createdAt)
  );
