const mongoose = require('mongoose');
const {
  ConversationContext,
  CONVERSATION_CONTEXTS,
  ConversationType,
  CONVERSATION_TYPES,
  ParticipantRole,
  PARTICIPANT_ROLES,
  GROUP_NAME_MAX_LENGTH,
  GROUP_MAX_PARTICIPANTS,
} = require('../constants/chat');

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** Chỉ có nghĩa trong nhóm: quản trị nhóm mới được thêm, gỡ thành viên và đổi tên. */
    role: { type: String, enum: PARTICIPANT_ROLES, default: ParticipantRole.MEMBER },
    lastReadAt: { type: Date, default: null },
    /**
     * Đếm sẵn thay vì đếm lại trong Message mỗi lần: con số này hiện trên mọi màn hình
     * (chấm đỏ ở tab tin nhắn) nên bị hỏi liên tục, còn nó chỉ đổi ở đúng hai chỗ —
     * lúc gửi và lúc đánh dấu đã đọc.
     */
    unreadCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: CONVERSATION_TYPES, default: ConversationType.DIRECT },
    participants: {
      type: [participantSchema],
      validate: {
        validator(list) {
          if (this.type === ConversationType.GROUP) {
            return list.length >= 2 && list.length <= GROUP_MAX_PARTICIPANTS;
          }
          return list.length === 2;
        },
        message: 'Participant count does not match the conversation type',
      },
    },
    /**
     * Khoá chống trùng: hai người bấm "nhắn tin" cùng lúc phải rơi vào cùng một hội thoại
     * chứ không tạo hai luồng song song. Cặp id được sắp xếp nên thứ tự người mở không đổi
     * kết quả, và ngữ cảnh nằm trong khoá nên trao đổi về trận đấu này không lẫn vào trận khác.
     *
     * Nhóm không có cặp nào để ghép nên không có gì để chống trùng — nó vẫn mang khoá,
     * dựng từ chính `_id`, để chỉ mục unique này không phải đổi sang `sparse` (đổi options
     * của một index đã tồn tại thì mongoose im lặng bỏ qua, và lỗi chỉ lộ ra trên production).
     */
    key: { type: String, required: true, unique: true },
    /** Tên nhóm. Hội thoại tay đôi lấy tên người kia nên để rỗng. */
    name: { type: String, trim: true, maxlength: GROUP_NAME_MAX_LENGTH, default: '' },
    avatar: { type: String, default: '' },
    /** Người lập nhóm — giữ lại để biết nhóm này từ đâu ra kể cả khi họ đã rời đi. */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    context: {
      type: { type: String, enum: CONVERSATION_CONTEXTS, default: ConversationContext.DIRECT },
      ref: { type: mongoose.Schema.Types.ObjectId },
    },
    // Bản xem trước cho danh sách hội thoại — nếu không có, mỗi lần mở hộp thư là một
    // truy vấn tin nhắn cuối cho từng hội thoại.
    lastMessage: {
      body: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      sentAt: { type: Date },
    },
  },
  { timestamps: true }
);

// Hộp thư sắp xếp theo tin mới nhất, lọc theo người tham gia.
conversationSchema.index({ 'participants.user': 1, 'lastMessage.sentAt': -1 });

/** Khoá chống trùng cho một cặp người trong một ngữ cảnh. */
conversationSchema.statics.buildKey = (
  userIdA,
  userIdB,
  contextType = ConversationContext.DIRECT,
  contextRef = null
) => {
  const pair = [userIdA.toString(), userIdB.toString()].sort().join('_');
  return `${pair}:${contextType}:${contextRef ? contextRef.toString() : 'none'}`;
};

/** Khoá của một nhóm: chính id của nó, vì không có gì để chống trùng. */
conversationSchema.statics.buildGroupKey = (conversationId) => `group:${conversationId.toString()}`;

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
