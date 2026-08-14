const mongoose = require('mongoose');
const { ConversationContext, CONVERSATION_CONTEXTS } = require('../constants/chat');

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
    participants: {
      type: [participantSchema],
      validate: {
        validator: (list) => list.length === 2,
        message: 'A conversation must have exactly 2 participants',
      },
    },
    /**
     * Khoá chống trùng: hai người bấm "nhắn tin" cùng lúc phải rơi vào cùng một hội thoại
     * chứ không tạo hai luồng song song. Cặp id được sắp xếp nên thứ tự người mở không đổi
     * kết quả, và ngữ cảnh nằm trong khoá nên trao đổi về trận đấu này không lẫn vào trận khác.
     */
    key: { type: String, required: true, unique: true },
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

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
