/**
 * Ngữ cảnh của một hội thoại — lý do hai người bắt đầu nói chuyện.
 *
 * Ngữ cảnh nằm trong khoá chống trùng, nên trao đổi về trận đấu này không lẫn vào
 * trận khác, và nó cũng là thứ quyết định ai được mở hội thoại với ai
 * (xem `assertCanOpen` trong `services/chat/`).
 *
 * Chỉ có nghĩa với hội thoại tay đôi. Nhóm không sinh ra từ một lịch đặt hay một trận
 * đấu nào nên luôn mang ngữ cảnh `DIRECT` — với nhóm, `type` mới là thứ đáng đọc.
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
 * Hội thoại tay đôi hay nhóm nhiều người.
 *
 * Hai loại nằm chung một collection vì tin nhắn, trạng thái đọc và hộp thư của chúng
 * giống hệt nhau — tách bảng chỉ để đổi số người tham gia là nhân đôi mọi truy vấn ấy.
 */
const ConversationType = {
  DIRECT: 'direct',
  GROUP: 'group',
};

const CONVERSATION_TYPES = Object.values(ConversationType);

/**
 * Vai trò trong một nhóm. Chỉ quản trị nhóm được thêm, gỡ thành viên và đổi tên —
 * người tạo nhóm là quản trị đầu tiên.
 *
 * Ai cũng thêm được thì một nhóm đội bóng biến thành chỗ người lạ kéo nhau vào, còn
 * quản lý đội mất quyền kiểm soát chính cái nhóm mình lập ra.
 */
const ParticipantRole = {
  ADMIN: 'admin',
  MEMBER: 'member',
};

const PARTICIPANT_ROLES = Object.values(ParticipantRole);

/**
 * Tin thường do người gõ, tin hệ thống do server sinh ra khi nhóm đổi ("A đã thêm B").
 *
 * Ghi chúng thành tin nhắn chứ không phải một bảng nhật ký riêng: thứ tự thời gian của
 * một nhóm chỉ đúng khi mọi sự kiện nằm chung một dòng thời gian.
 */
const MessageKind = {
  TEXT: 'text',
  SYSTEM: 'system',
};

const MESSAGE_KINDS = Object.values(MessageKind);

/**
 * Chat là để chốt giờ, chốt sân, hỏi giá — không phải chỗ dán hợp đồng. Trần này đủ rộng
 * cho mọi tin nhắn thật và giữ cho một tin không thể thổi phồng payload đẩy qua WebSocket.
 */
const MESSAGE_MAX_LENGTH = 2000;

const GROUP_NAME_MAX_LENGTH = 100;

/**
 * Mỗi tin nhắn trong nhóm là một lượt ghi cho từng thành viên (bộ đếm chưa đọc) và có thể
 * là một thông báo đẩy. Trần này giữ chi phí đó ở mức đoán được, và một đội bóng đông nhất
 * cũng không chạm tới.
 */
const GROUP_MAX_PARTICIPANTS = 50;

module.exports = {
  ConversationContext,
  CONVERSATION_CONTEXTS,
  ConversationType,
  CONVERSATION_TYPES,
  ParticipantRole,
  PARTICIPANT_ROLES,
  MessageKind,
  MESSAGE_KINDS,
  MESSAGE_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  GROUP_MAX_PARTICIPANTS,
};
