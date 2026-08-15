import type { ChatMessage, Conversation, ConversationParticipant } from '@/types';

/**
 * Những câu hỏi mà mọi màn hình chat đều hỏi: hội thoại này tên gì, ai là người kia,
 * mình còn bao nhiêu tin chưa đọc, mình có quyền sửa nhóm không.
 *
 * Chúng là hàm thuần và nằm ngoài component vì cùng một câu trả lời phải giống nhau ở
 * hộp thư, ở đầu khung chat và trong thông báo — ba chỗ vẽ lại cùng một dòng chữ.
 */

export const participantsExcept = (conversation: Conversation, userId?: string) =>
  conversation.participants.filter((p) => p.user._id !== userId);

/**
 * Tên hiển thị: nhóm lấy tên nhóm, tay đôi lấy tên người kia.
 *
 * Người kia có thể đã rời nhóm hoặc bị xoá, nên vẫn phải ra một cái tên đọc được —
 * một dòng trống trong hộp thư là thứ không ai bấm vào.
 */
export const conversationTitle = (conversation: Conversation, userId?: string) => {
  if (conversation.type === 'group') return conversation.name || 'Nhóm chat';

  const other = participantsExcept(conversation, userId)[0];
  return other?.user.fullName || other?.user.username || 'Người dùng';
};

/** Ảnh đại diện để vẽ cạnh tên; nhóm chưa có ảnh riêng thì để rỗng và rơi về chữ cái đầu. */
export const conversationAvatar = (conversation: Conversation, userId?: string) => {
  if (conversation.type === 'group') return conversation.avatar;
  return participantsExcept(conversation, userId)[0]?.user.avatar ?? '';
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

/**
 * Tin nhắn cuối của mình đã có ai đọc chưa — để hiện "Đã xem".
 *
 * Trạng thái đọc là một mốc thời gian mỗi người, nên "đã xem" nghĩa là có ít nhất một
 * người khác đọc tới sau lúc tin này được gửi.
 */
export const isSeenByOthers = (
  conversation: Conversation,
  message: ChatMessage,
  userId?: string
) =>
  participantsExcept(conversation, userId).some(
    (p) => p.lastReadAt !== null && new Date(p.lastReadAt) >= new Date(message.createdAt)
  );

/** Dòng xem trước trong hộp thư: "Bạn: ..." khi tin cuối là của mình. */
export const previewOf = (conversation: Conversation, userId?: string) => {
  const last = conversation.lastMessage;
  if (!last?.body) return 'Chưa có tin nhắn nào';
  return last.sender === userId ? `Bạn: ${last.body}` : last.body;
};

/**
 * Tin nhắn nào bắt đầu một cụm mới.
 *
 * Facebook gộp các tin liên tiếp của cùng một người thành một cụm và chỉ vẽ avatar ở tin
 * đầu; cụm bị cắt khi đổi người gửi hoặc khi hai tin cách nhau quá lâu để còn là một mạch
 * trò chuyện.
 */
const CLUSTER_GAP_MS = 5 * 60 * 1000;

export const startsCluster = (message: ChatMessage, previous?: ChatMessage) => {
  if (!previous) return true;
  if (previous.sender?._id !== message.sender?._id) return true;
  return new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > CLUSTER_GAP_MS;
};
