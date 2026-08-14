/**
 * Ngữ cảnh của một hội thoại — lý do hai người bắt đầu nói chuyện.
 *
 * Ngữ cảnh nằm trong khoá chống trùng, nên trao đổi về trận đấu này không lẫn vào
 * trận khác, và nó cũng là thứ quyết định ai được mở hội thoại với ai
 * (xem `assertCanOpen` trong `chat.service.js`).
 */
const ConversationContext = {
  /** Nhắn thẳng, không gắn vào việc gì. */
  DIRECT: 'direct',
  /** Khách đặt sân ↔ chủ sân, quanh một lịch đặt cụ thể. */
  BOOKING: 'booking',
  /** Quản lý hai đội chốt một trận đấu. */
  MATCH_REQUEST: 'match_request',
  /** Người chơi hỏi chủ sân trước khi đặt. */
  FIELD: 'field',
};

const CONVERSATION_CONTEXTS = Object.values(ConversationContext);

/**
 * Chat là để chốt giờ, chốt sân, hỏi giá — không phải chỗ dán hợp đồng. Trần này đủ rộng
 * cho mọi tin nhắn thật và giữ cho một tin không thể thổi phồng payload đẩy qua WebSocket.
 */
const MESSAGE_MAX_LENGTH = 2000;

module.exports = { ConversationContext, CONVERSATION_CONTEXTS, MESSAGE_MAX_LENGTH };
