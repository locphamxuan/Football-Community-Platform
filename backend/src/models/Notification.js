const mongoose = require('mongoose');
const { NOTIFICATION_TYPES, NOTIFICATION_TTL_DAYS } = require('../constants/notifications');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, default: '', maxlength: 500 },
    /**
     * Đường dẫn trong app để bấm vào là tới thẳng đối tượng liên quan.
     * Lưu link thay vì id + type để frontend không phải giữ bảng tra cứu thứ hai
     * — nơi duy nhất biết một booking nằm ở URL nào là backend lúc bắn thông báo.
     */
    link: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hộp thư luôn đọc theo "của tôi, mới nhất trước"; lọc chưa đọc đi qua cùng index này.
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_DAYS * 86400 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
