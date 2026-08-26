const Conversation = require('../../models/Conversation');
const { getPagination } = require('../../utils/pagination');
const { ConversationContext, ConversationType } = require('../../constants/chat');
const {
  PROFILE_FIELDS, assertCanOpen, loadForParticipant, populateConversation, reloadConversation,
} = require('./helpers');

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

module.exports = { openConversation, getMyConversations, getConversation };
