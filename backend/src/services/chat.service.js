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
const {
  ConversationContext,
  ConversationType,
  ParticipantRole,
  MessageKind,
  GROUP_MAX_PARTICIPANTS,
} = require('../constants/chat');
const { NotificationType } = require('../constants/notifications');
const Role = require('../constants/roles');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');
const env = require('../config/env');

const PROFILE_FIELDS = 'username fullName avatar roles';
const RATE_WINDOW_SECONDS = 60;

const forbidden = (message) => new AppError(message, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
const notFound = (message) => new AppError(message, HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
const invalid = (message) => new AppError(message, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

/**
 * Id dưới dạng chuỗi, dù đang cầm ObjectId hay một hồ sơ đã populate.
 *
 * `participants.user` là ObjectId ở chỗ này và là cả một document ở chỗ kia; gọi thẳng
 * `toString()` lên document trả về phần mô tả object chứ không phải id, và tin nhắn lặng lẽ
 * bay vào một phòng socket không tồn tại.
 */
const idOf = (value) => {
  if (!value) return undefined;
  return (typeof value === 'object' && value._id ? value._id : value).toString();
};

const sameSet = (pair, other) => {
  const a = pair.map(idOf).sort();
  const b = other.map(idOf).sort();
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

/**
 * Ai được kéo vào một cuộc trò chuyện.
 *
 * Quản trị viên nền tảng đứng ngoài: họ xử lý khiếu nại bằng công cụ quản trị, và một
 * kênh riêng với họ ở trong app là kênh không ai đọc log được. Chặn ở cả hai đầu — mở
 * hội thoại *với* họ (ở đây) và họ tự mở (ở `chat.routes.js` và `socket/handlers.js`).
 */
const assertChattable = (user) => {
  if (!user) throw notFound('User not found');
  if (user.status !== 'active') throw forbidden('This user is not available for chat');
  if (user.roles?.includes(Role.ADMIN)) throw forbidden('Administrators do not take part in chat');
};

const assertCanOpen = async (userId, recipientId, contextType, contextRef) => {
  if (idOf(userId) === idOf(recipientId)) {
    throw invalid('You cannot start a conversation with yourself');
  }

  assertChattable(await User.findById(recipientId).select('status roles'));

  // Nhắn thẳng thì mở cho mọi tài khoản: người chơi phải hỏi được chủ sân trước khi đặt,
  // và quản lý đội phải rủ được người lạ vào đội. Trần tần suất ở `assertUnderRateLimit`
  // là thứ chặn spam, chứ không phải một danh sách bạn bè mà nền tảng này không có.
  if (contextType === ConversationContext.DIRECT) return;

  const { parties, owner } = await partiesOf(contextType, contextRef);

  // Sân không có "hai bên": ai cũng hỏi được, miễn là người nhận đúng là chủ sân đó.
  if (owner) {
    if (idOf(owner) !== idOf(recipientId)) throw forbidden('You can only message the owner of this field');
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

  const isParticipant = conversation.participants.some((p) => idOf(p.user) === idOf(userId));
  if (!isParticipant) throw forbidden('You are not a participant in this conversation');

  return conversation;
};

/** Mọi người trong hội thoại trừ chính mình — người nhận tin, chấm chưa đọc và "đã xem". */
const recipientsOf = (conversation, userId) =>
  conversation.participants
    .map((p) => idOf(p.user))
    .filter((id) => id !== idOf(userId));

const participantIdsOf = (conversation) => conversation.participants.map((p) => idOf(p.user));

/**
 * Nhóm chỉ đổi được bởi quản trị của chính nó.
 *
 * Ai cũng thêm người được thì nhóm của một đội bóng biến thành chỗ người lạ kéo nhau vào,
 * và quản lý đội mất quyền kiểm soát đúng cái nhóm mình lập ra. Rời nhóm thì khác — đó là
 * quyền của mọi thành viên (xem `leaveGroup`).
 */
const assertGroupAdmin = (conversation, userId) => {
  if (conversation.type !== ConversationType.GROUP) throw invalid('This conversation is not a group');

  const me = conversation.participants.find((p) => idOf(p.user) === idOf(userId));
  if (me?.role !== ParticipantRole.ADMIN) throw forbidden('Only a group admin can do this');
};

/**
 * Trần tần suất nằm ở service chứ không ở middleware, vì tin nhắn tới bằng hai đường —
 * `POST /chat/.../messages` và sự kiện WebSocket — mà chỉ đường đầu đi qua express.
 * Đặt ở đây thì cả hai đường dùng chung đúng một bộ đếm và một con số.
 */
const assertUnderRateLimit = async (userId) => {
  const count = await cache.incr(CacheKeys.chatRate(idOf(userId)), RATE_WINDOW_SECONDS);
  if (count > env.CHAT_RATE_MAX) {
    throw new AppError('Too many messages, please slow down', HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS);
  }
};

const populateConversation = (conversation) =>
  conversation.populate('participants.user', PROFILE_FIELDS);

const reloadConversation = (conversationId) =>
  Conversation.findById(conversationId).populate('participants.user', PROFILE_FIELDS);

/** Hội thoại vừa đổi — client tải lại đúng một hội thoại thay vì cả hộp thư. */
const emitConversation = (userIds, conversation) => {
  if (!userIds.length) return;
  emitToUsers(userIds, ServerEvent.CONVERSATION_UPDATED, { conversation });
};

/**
 * Tin hệ thống: server tự ghi khi nhóm đổi ("A đã thêm B").
 *
 * Không cộng vào bộ đếm chưa đọc — đổi tên nhóm không đáng một chấm đỏ, còn dòng chữ
 * vẫn hiện đúng chỗ trong dòng thời gian khi người ta mở nhóm ra.
 */
const postSystemMessage = async (conversation, actorId, body) => {
  const message = await Message.create({
    conversation: conversation._id,
    sender: actorId,
    kind: MessageKind.SYSTEM,
    body,
  });

  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessage: { body, sender: actorId, sentAt: message.createdAt } } }
  );

  const populated = await message.populate('sender', PROFILE_FIELDS);
  emitToUsers(participantIdsOf(conversation), ServerEvent.NEW_MESSAGE, {
    conversationId: idOf(conversation._id),
    message: populated,
  });

  return populated;
};

/** Tên để ghép vào tin hệ thống. Không có hồ sơ thì vẫn phải ra một câu đọc được. */
const nameOf = (user) => user?.fullName || user?.username || 'một người dùng';

const loadChattableUsers = async (memberIds) => {
  const users = await User.find({ _id: { $in: memberIds } }).select('status roles fullName username');
  if (users.length !== memberIds.length) throw notFound('Some of these users no longer exist');
  users.forEach(assertChattable);
  return users;
};

// ─── openConversation ─────────────────────────────────────────────────────────
/**
 * Mở hội thoại tay đôi, hoặc trả lại cái đã có. Bấm "nhắn tin" lần thứ hai phải quay về đúng
 * luồng cũ chứ không đẻ ra luồng mới — khoá `key` là thứ bảo đảm điều đó, kể cả khi
 * hai người bấm cùng lúc.
 */
const openConversation = async (userId, data) => {
  const contextType = data.contextType || ConversationContext.DIRECT;
  const contextRef = contextType === ConversationContext.DIRECT ? null : data.contextRef;

  await assertCanOpen(userId, data.recipientId, contextType, contextRef);

  const key = Conversation.buildKey(userId, data.recipientId, contextType, contextRef);
  const existing = await Conversation.findOne({ key });
  if (existing) return populateConversation(existing);

  try {
    const conversation = await Conversation.create({
      key,
      type: ConversationType.DIRECT,
      participants: [{ user: userId }, { user: data.recipientId }],
      context: { type: contextType, ref: contextRef || undefined },
    });
    return populateConversation(conversation);
  } catch (err) {
    // Người kia vừa tạo trước trong tích tắc — chỉ số unique đã làm đúng việc của nó.
    if (err.code === 11000) {
      return Conversation.findOne({ key }).populate('participants.user', PROFILE_FIELDS);
    }
    throw err;
  }
};

// ─── createGroup ──────────────────────────────────────────────────────────────
/**
 * Lập một nhóm. Người lập là quản trị nhóm.
 *
 * `_id` được sinh trước khi ghi để `key` dựng được từ nó: nhóm không có cặp người nào để
 * chống trùng, nhưng chỉ mục unique trên `key` thì dùng chung với hội thoại tay đôi.
 */
const createGroup = async (userId, { name, memberIds }) => {
  const others = [...new Set(memberIds.map(idOf))].filter((id) => id !== idOf(userId));
  if (!others.length) throw invalid('A group needs at least one other member');
  if (others.length + 1 > GROUP_MAX_PARTICIPANTS) {
    throw invalid(`A group cannot hold more than ${GROUP_MAX_PARTICIPANTS} members`);
  }

  await loadChattableUsers(others);

  const _id = new mongoose.Types.ObjectId();
  const conversation = await Conversation.create({
    _id,
    key: Conversation.buildGroupKey(_id),
    type: ConversationType.GROUP,
    name,
    createdBy: userId,
    participants: [
      { user: userId, role: ParticipantRole.ADMIN },
      ...others.map((user) => ({ user, role: ParticipantRole.MEMBER })),
    ],
  });

  const actor = await User.findById(userId).select('fullName username');
  await postSystemMessage(conversation, userId, `${nameOf(actor)} đã tạo nhóm "${name}"`);

  const populated = await reloadConversation(_id);
  emitConversation(participantIdsOf(conversation), populated);
  return populated;
};

// ─── addMembers ───────────────────────────────────────────────────────────────
const addMembers = async (userId, conversationId, memberIds) => {
  const conversation = await loadForParticipant(conversationId, userId);
  assertGroupAdmin(conversation, userId);

  const current = new Set(participantIdsOf(conversation).map(idOf));
  const added = [...new Set(memberIds.map(idOf))].filter((id) => !current.has(id));
  if (!added.length) throw invalid('These users are already in the group');
  if (current.size + added.length > GROUP_MAX_PARTICIPANTS) {
    throw invalid(`A group cannot hold more than ${GROUP_MAX_PARTICIPANTS} members`);
  }

  const users = await loadChattableUsers(added);

  await Conversation.updateOne(
    { _id: conversationId },
    { $push: { participants: { $each: added.map((user) => ({ user, role: ParticipantRole.MEMBER })) } } }
  );

  const actor = await User.findById(userId).select('fullName username');
  const updated = await reloadConversation(conversationId);
  await postSystemMessage(updated, userId, `${nameOf(actor)} đã thêm ${users.map(nameOf).join(', ')} vào nhóm`);

  emitConversation(participantIdsOf(updated), updated);
  return updated;
};

// ─── removeMember ─────────────────────────────────────────────────────────────
const removeMember = async (userId, conversationId, memberId) => {
  const conversation = await loadForParticipant(conversationId, userId);
  assertGroupAdmin(conversation, userId);

  if (idOf(memberId) === idOf(userId)) throw invalid('Leave the group instead of removing yourself');
  if (!participantIdsOf(conversation).some((id) => idOf(id) === idOf(memberId))) {
    throw notFound('This user is not in the group');
  }

  await Conversation.updateOne(
    { _id: conversationId },
    { $pull: { participants: { user: new mongoose.Types.ObjectId(idOf(memberId)) } } }
  );

  const [actor, removed] = await Promise.all([
    User.findById(userId).select('fullName username'),
    User.findById(memberId).select('fullName username'),
  ]);
  const updated = await reloadConversation(conversationId);
  await postSystemMessage(updated, userId, `${nameOf(actor)} đã gỡ ${nameOf(removed)} khỏi nhóm`);

  // Người bị gỡ cũng phải nhận sự kiện, nếu không nhóm vẫn nằm trong hộp thư của họ
  // cho tới lần tải lại trang tiếp theo.
  emitConversation([...participantIdsOf(updated), memberId], updated);
  return updated;
};

// ─── leaveGroup ───────────────────────────────────────────────────────────────
/**
 * Rời nhóm là quyền của mọi thành viên, kể cả quản trị.
 *
 * Người cuối cùng rời đi thì nhóm và toàn bộ tin nhắn biến mất: giữ lại một nhóm rỗng
 * là giữ một đống dữ liệu không ai mở được nữa. Còn quản trị cuối cùng rời đi thì người
 * kỳ cựu nhất lên thay, nếu không nhóm kẹt vĩnh viễn ở trạng thái không ai thêm được ai.
 */
const leaveGroup = async (userId, conversationId) => {
  const conversation = await loadForParticipant(conversationId, userId);
  if (conversation.type !== ConversationType.GROUP) throw invalid('This conversation is not a group');

  const remaining = conversation.participants.filter((p) => idOf(p.user) !== idOf(userId));

  if (!remaining.length) {
    await Promise.all([
      Conversation.deleteOne({ _id: conversationId }),
      Message.deleteMany({ conversation: conversationId }),
    ]);
    return { conversationId: idOf(conversationId), deleted: true };
  }

  await Conversation.updateOne(
    { _id: conversationId },
    { $pull: { participants: { user: new mongoose.Types.ObjectId(idOf(userId)) } } }
  );

  if (!remaining.some((p) => p.role === ParticipantRole.ADMIN)) {
    await Conversation.updateOne(
      { _id: conversationId, 'participants.user': remaining[0].user },
      { $set: { 'participants.$.role': ParticipantRole.ADMIN } }
    );
  }

  const actor = await User.findById(userId).select('fullName username');
  const updated = await reloadConversation(conversationId);
  await postSystemMessage(updated, userId, `${nameOf(actor)} đã rời nhóm`);

  emitConversation([...participantIdsOf(updated), userId], updated);
  return { conversationId: idOf(conversationId), deleted: false };
};

// ─── updateGroup ──────────────────────────────────────────────────────────────
const updateGroup = async (userId, conversationId, { name }) => {
  const conversation = await loadForParticipant(conversationId, userId);
  assertGroupAdmin(conversation, userId);

  await Conversation.updateOne({ _id: conversationId }, { $set: { name } });

  const actor = await User.findById(userId).select('fullName username');
  const updated = await reloadConversation(conversationId);
  await postSystemMessage(updated, userId, `${nameOf(actor)} đã đổi tên nhóm thành "${name}"`);

  emitConversation(participantIdsOf(updated), updated);
  return updated;
};

// ─── getMyConversations ───────────────────────────────────────────────────────
const getMyConversations = async (userId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { 'participants.user': userId };
  if (query.contextType) filter['context.type'] = query.contextType;
  if (query.type) filter.type = query.type;

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

// ─── getConversation ──────────────────────────────────────────────────────────
/** Một hội thoại lẻ — màn hình mở thẳng bằng link không có sẵn hộp thư để tra. */
const getConversation = async (userId, conversationId) => {
  await loadForParticipant(conversationId, userId);
  return reloadConversation(conversationId);
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

module.exports = {
  openConversation, createGroup, addMembers, removeMember, leaveGroup, updateGroup,
  getMyConversations, getConversation, getMessages,
  sendMessage, markRead, countUnread, notifyTyping,
};
