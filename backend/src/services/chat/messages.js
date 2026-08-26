const mongoose = require('mongoose');
const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const { notify } = require('../notification.service');
const { emitToUsers, isOnline } = require('../../socket/emitter');
const { ServerEvent } = require('../../socket/events');
const { getPagination } = require('../../utils/pagination');
const { ConversationType } = require('../../constants/chat');
const { NotificationType } = require('../../constants/notifications');
const {
  PROFILE_FIELDS, idOf, loadForParticipant, recipientsOf, assertUnderRateLimit,
} = require('./helpers');

// ─── getMessages ──────────────────────────────────────────────────────────────
const getMessages = async (userId, conversationId, query) => {
  await loadForParticipant(conversationId, userId);
  const { page, limit, skip } = getPagination(query);

  const [messages, total] = await Promise.all([
    Message.find({ conversation: conversationId })
      .populate('sender', PROFILE_FIELDS)
      .sort('-createdAt').skip(skip).limit(limit),
    Message.countDocuments({ conversation: conversationId }),
  ]);

  return { messages, total, page, limit };
};

// ─── sendMessage ──────────────────────────────────────────────────────────────
/**
 * Lưu tin nhắn rồi mới đẩy realtime.
 *
 * Thứ tự này là cố ý: MongoDB là nguồn sự thật, WebSocket chỉ là đường tắt để không phải
 * hỏi lại server. Đẩy trước rồi lưu lỗi nghĩa là hai người nhìn thấy một tin nhắn mà lịch sử
 * hội thoại không có — kiểu sai tệ nhất trong một khung chat, vì không ai biết mình đang sai.
 */
const sendMessage = async (userId, conversationId, body) => {
  const conversation = await loadForParticipant(conversationId, userId);
  await assertUnderRateLimit(userId);

  const recipients = recipientsOf(conversation, userId);

  const message = await Message.create({ conversation: conversationId, sender: userId, body });

  // Một lệnh ghi cho cả nhóm: `arrayFilters` cộng bộ đếm cho mọi người trừ người gửi,
  // thay vì một vòng lặp updateOne mà số lượt ghi tăng theo số thành viên.
  await Conversation.updateOne(
    { _id: conversationId },
    {
      $set: { lastMessage: { body: message.body, sender: userId, sentAt: message.createdAt } },
      $inc: { 'participants.$[other].unreadCount': 1 },
    },
    { arrayFilters: [{ 'other.user': { $ne: new mongoose.Types.ObjectId(idOf(userId)) } }] }
  );

  const populated = await message.populate('sender', PROFILE_FIELDS);
  const payload = { conversationId: idOf(conversationId), message: populated };

  // Đẩy cho cả người gửi: họ có thể đang mở cùng hội thoại trên máy tính lẫn điện thoại,
  // và màn hình còn lại phải thấy tin vừa gửi mà không cần tải lại.
  emitToUsers([userId, ...recipients], ServerEvent.NEW_MESSAGE, payload);

  const title = conversation.type === ConversationType.GROUP
    ? `${populated.sender?.fullName || 'Một thành viên'} · ${conversation.name}`
    : `Tin nhắn mới từ ${populated.sender?.fullName || 'một người dùng'}`;

  await Promise.all(recipients.map(async (recipientId) => {
    if (await isOnline(recipientId)) return;
    await notify(recipientId, {
      type: NotificationType.CHAT_MESSAGE,
      title,
      body: message.body,
      link: `/chat/${conversationId}`,
    }, userId);
  }));

  return { message: populated, conversation };
};

// ─── markRead ─────────────────────────────────────────────────────────────────
const markRead = async (userId, conversationId) => {
  const conversation = await loadForParticipant(conversationId, userId);
  const readAt = new Date();

  await Conversation.updateOne(
    { _id: conversationId, 'participants.user': userId },
    { $set: { 'participants.$.lastReadAt': readAt, 'participants.$.unreadCount': 0 } }
  );

  // Chỉ người khác cần biết: "đã xem" là thông tin dành cho người gửi.
  emitToUsers(recipientsOf(conversation, userId), ServerEvent.READ, {
    conversationId: idOf(conversationId),
    userId: idOf(userId),
    readAt,
  });

  return { conversationId: idOf(conversationId), readAt };
};

// ─── countUnread ──────────────────────────────────────────────────────────────
/** Tổng tin chưa đọc của một người, cho chấm đỏ ở tab tin nhắn. */
const countUnread = async (userId) => {
  // Aggregate không tự ép chuỗi thành ObjectId như query thường — quên bước này thì
  // `$match` không khớp gì cả và chấm đỏ im lặng đứng ở 0.
  const id = new mongoose.Types.ObjectId(String(userId));
  const [result] = await Conversation.aggregate([
    { $match: { 'participants.user': id } },
    { $unwind: '$participants' },
    { $match: { 'participants.user': id } },
    { $group: { _id: null, total: { $sum: '$participants.unreadCount' } } },
  ]);
  return result?.total ?? 0;
};

// ─── notifyTyping ─────────────────────────────────────────────────────────────
/**
 * "Đang nhập..." không được lưu: nó hết giá trị sau vài giây, và ghi mỗi lần gõ phím
 * xuống database là đổi một dòng thông tin trang trí lấy tải ghi liên tục.
 */
const notifyTyping = async (userId, conversationId, isTyping) => {
  const conversation = await loadForParticipant(conversationId, userId);
  emitToUsers(recipientsOf(conversation, userId), ServerEvent.TYPING, {
    conversationId: idOf(conversationId),
    userId: idOf(userId),
    isTyping,
  });
};

module.exports = { getMessages, sendMessage, markRead, countUnread, notifyTyping };
