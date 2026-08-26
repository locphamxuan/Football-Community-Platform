const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const User = require('../../models/User');
const Field = require('../../models/Field');
const Booking = require('../../models/Booking');
const MatchRequest = require('../../models/MatchRequest');
const { emitToUsers } = require('../../socket/emitter');
const { ServerEvent } = require('../../socket/events');
const { cache, CacheKeys } = require('../../config/redis');
const {
  ConversationContext, ConversationType, ParticipantRole, MessageKind,
} = require('../../constants/chat');
const Role = require('../../constants/roles');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');
const env = require('../../config/env');

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

module.exports = {
  PROFILE_FIELDS,
  invalid,
  notFound,
  idOf,
  assertCanOpen,
  loadForParticipant,
  recipientsOf,
  participantIdsOf,
  assertGroupAdmin,
  assertUnderRateLimit,
  populateConversation,
  reloadConversation,
  emitConversation,
  postSystemMessage,
  nameOf,
  loadChattableUsers,
};
