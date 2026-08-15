const mongoose = require('mongoose');
const { MESSAGE_MAX_LENGTH, MessageKind, MESSAGE_KINDS } = require('../constants/chat');

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    /** Với tin hệ thống, đây là người gây ra thay đổi ("A đã thêm B vào nhóm"). */
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: MESSAGE_KINDS, default: MessageKind.TEXT },
    body: { type: String, required: true, trim: true, maxlength: MESSAGE_MAX_LENGTH },
  },
  { timestamps: true }
);

/**
 * Không có cờ "đã đọc" trên từng tin nhắn. Trạng thái đọc là **một mốc thời gian mỗi người**
 * (`participants.lastReadAt` ở Conversation): người kia đọc tới đâu thì mọi tin gửi trước
 * mốc đó là đã đọc. Ghi cờ cho từng tin nghĩa là mỗi lần mở hội thoại phải cập nhật hàng
 * trăm bản ghi để nói đúng một điều mà một mốc thời gian đã nói đủ.
 */
messageSchema.index({ conversation: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
