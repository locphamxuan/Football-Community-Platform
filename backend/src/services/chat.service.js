const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Field = require('../models/Field');
const Booking = require('../models/Booking');
const MatchRequest = require('../models/MatchRequest');
const { notify } = require('./notification.service');
const { emitToUsers, isOnline } = require('../socket/emitter');
const { ServerEvent } = require('../socket/events');
const { getPagination } = require('../utils/pagination');
const { cache, CacheKeys } = require('../config/redis');
const { ConversationContext } = require('../constants/chat');
const { NotificationType } = require('../constants/notifications');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');
const env = require('../config/env');

const PROFILE_FIELDS = 'username fullName avatar roles';
const RATE_WINDOW_SECONDS = 60;

const forbidden = (message) => new AppError(message, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
const notFound = (message) => new AppError(message, HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

const sameSet = (pair, other) => {
  const a = pair.map((id) => id?.toString()).sort();
  const b = other.map((id) => id?.toString()).sort();
  return a[0] === b[0] && a[1] === b[1] && Boolean(a[0]);
};

/**
 * Hai người trong ngữ cảnh này là ai — trả về đúng cặp id được phép nói chuyện.
 *
 * Đây là chỗ duy nhất quyết định "được mở hội thoại hay không" cho các ngữ cảnh có ràng buộc.
 * Không kiểm ở đây thì bất kỳ ai cũng gắn hội thoại của mình vào một lịch đặt của người khác
 * và biến nó thành thứ trông như trao đổi chính thức giữa khách và chủ sân.
 */
const partiesOf = async (contextType, contextRef) => {
  if (contextType === ConversationContext.FIELD) {
    const field = await Field.findById(contextRef).select('owner');
    if (!field) throw notFound('Field not found');
    return { parties: null, owner: field.owner };
  }

  if (contextType === ConversationContext.BOOKING) {
    const booking = await Booking.findById(contextRef).populate('field', 'owner');
    if (!booking) throw notFound('Booking not found');
    return { parties: [booking.user, booking.field?.owner] };
  }

  const matchRequest = await MatchRequest.findById(contextRef)
    .populate('requesterTeam', 'manager')
    .populate('opponentTeam', 'manager');
  if (!matchRequest) throw notFound('Match request not found');
  return { parties: [matchRequest.requesterTeam?.manager, matchRequest.opponentTeam?.manager] };
};

const assertCanOpen = async (userId, recipientId, contextType, contextRef) => {
  if (userId.toString() === recipientId.toString()) {
    throw new AppError('You cannot start a conversation with yourself', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }

  const recipient = await User.findById(recipientId).select('status');
  if (!recipient) throw notFound('Recipient not found');
  if (recipient.status !== 'active') throw forbidden('This user is not available for chat');

  // Nhắn thẳng thì mở cho mọi tài khoản: người chơi phải hỏi được chủ sân trước khi đặt,
  // và quản lý đội phải rủ được người lạ vào đội. Trần tần suất ở `assertUnderRateLimit`
  // là thứ chặn spam, chứ không phải một danh sách bạn bè mà nền tảng này không có.
  if (contextType === ConversationContext.DIRECT) return;

  const { parties, owner } = await partiesOf(contextType, contextRef);

  // Sân không có "hai bên": ai cũng hỏi được, miễn là người nhận đúng là chủ sân đó.
  if (owner) {
    if (owner.toString() !== recipientId.toString()) throw forbidden('You can only message the owner of this field');
    return;
  }

  if (!sameSet(parties, [userId, recipientId])) {
    throw forbidden('You are not a party to this conversation');
  }
};

/** Hội thoại kèm quyền: không phải người trong cuộc thì coi như không tồn tại. */
const loadForParticipant = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw notFound('Conversation not found');

  const isParticipant = conversation.participants.some((p) => p.user.toString() === userId.toString());
  if (!isParticipant) throw forbidden('You are not a participant in this conversation');

  return conversation;
};

const otherParticipantId = (conversation, userId) =>
  conversation.participants.find((p) => p.user.toString() !== userId.toString())?.user;

/**
 * Trần tần suất nằm ở service chứ không ở middleware, vì tin nhắn tới bằng hai đường —
 * `POST /chat/.../messages` và sự kiện WebSocket — mà chỉ đường đầu đi qua express.
 * Đặt ở đây thì cả hai đường dùng chung đúng một bộ đếm và một con số.
 */
const assertUnderRateLimit = async (userId) => {
  const count = await cache.incr(CacheKeys.chatRate(userId.toString()), RATE_WINDOW_SECONDS);
  if (count > env.CHAT_RATE_MAX) {
    throw new AppError('Too many messages, please slow down', HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS);
  }
};

// ─── openConversation ─────────────────────────────────────────────────────────
/**
 * Mở hội thoại, hoặc trả lại cái đã có. Bấm "nhắn tin" lần thứ hai phải quay về đúng
 * luồng cũ chứ không đẻ ra luồng mới — khoá `key` là thứ bảo đảm điều đó, kể cả khi
 * hai người bấm cùng lúc.
 */
const openConversation = async (userId, data) => {
  const contextType = data.contextType || ConversationContext.DIRECT;
  const contextRef = contextType === ConversationContext.DIRECT ? null : data.contextRef;

  await assertCanOpen(userId, data.recipientId, contextType, contextRef);

  const key = Conversation.buildKey(userId, data.recipientId, contextType, contextRef);
  const existing = await Conversation.findOne({ key });
  if (existing) return existing.populate('participants.user', PROFILE_FIELDS);

  try {
    const conversation = await Conversation.create({
      key,
      participants: [{ user: userId }, { user: data.recipientId }],
      context: { type: contextType, ref: contextRef || undefined },
    });
    return conversation.populate('participants.user', PROFILE_FIELDS);
  } catch (err) {
    // Người kia vừa tạo trước trong tích tắc — chỉ số unique đã làm đúng việc của nó.
    if (err.code === 11000) {
      return Conversation.findOne({ key }).populate('participants.user', PROFILE_FIELDS);
    }
    throw err;
  }
};

// ─── getMyConversations ───────────────────────────────────────────────────────
const getMyConversations = async (userId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { 'participants.user': userId };
  if (query.contextType) filter['context.type'] = query.contextType;

  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .populate('participants.user', PROFILE_FIELDS)
      // Hội thoại vừa có tin nhắn nằm trên cùng; hội thoại mới mở chưa ai nói gì thì
      // rơi về ngày tạo thay vì tụt xuống đáy danh sách.
      .sort({ 'lastMessage.sentAt': -1, createdAt: -1 })
      .skip(skip).limit(limit),
    Conversation.countDocuments(filter),
  ]);

  return { conversations, total, page, limit };
};

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

  const recipientId = otherParticipantId(conversation, userId);

  const message = await Message.create({ conversation: conversationId, sender: userId, body });

  await Conversation.updateOne(
    { _id: conversationId, 'participants.user': recipientId },
    {
      $set: { lastMessage: { body: message.body, sender: userId, sentAt: message.createdAt } },
      $inc: { 'participants.$.unreadCount': 1 },
    }
  );

  const populated = await message.populate('sender', PROFILE_FIELDS);
  const payload = { conversationId: conversationId.toString(), message: populated };

  // Đẩy cho cả người gửi: họ có thể đang mở cùng hội thoại trên máy tính lẫn điện thoại,
  // và màn hình còn lại phải thấy tin vừa gửi mà không cần tải lại.
  emitToUsers([userId, recipientId], ServerEvent.NEW_MESSAGE, payload);

  if (!(await isOnline(recipientId))) {
    await notify(recipientId, {
      type: NotificationType.CHAT_MESSAGE,
      title: `Tin nhắn mới từ ${populated.sender?.fullName || 'một người dùng'}`,
      body: message.body,
      link: `/chat/${conversationId}`,
    }, userId);
  }

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

  // Chỉ người kia cần biết: "đã xem" là thông tin dành cho người gửi.
  const recipientId = otherParticipantId(conversation, userId);
  emitToUsers([recipientId], ServerEvent.READ, {
    conversationId: conversationId.toString(),
    userId: userId.toString(),
    readAt,
  });

  return { conversationId: conversationId.toString(), readAt };
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
  emitToUsers([otherParticipantId(conversation, userId)], ServerEvent.TYPING, {
    conversationId: conversationId.toString(),
    userId: userId.toString(),
    isTyping,
  });
};

module.exports = {
  openConversation, getMyConversations, getMessages,
  sendMessage, markRead, countUnread, notifyTyping,
};
