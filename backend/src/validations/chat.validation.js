const { z } = require('zod');
const {
  CONVERSATION_CONTEXTS,
  ConversationContext,
  CONVERSATION_TYPES,
  MESSAGE_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  GROUP_MAX_PARTICIPANTS,
} = require('../constants/chat');

// Id sai định dạng phải bị chặn tại đây. Để nó xuống tới mongoose thì lỗi trả về là
// CastError 400 với nội dung lộ tên trường trong database.
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

// Tin nhắn toàn khoảng trắng là tin nhắn rỗng — cắt trước rồi mới đo độ dài.
const messageBody = z.string().trim().min(1, 'Message cannot be empty').max(MESSAGE_MAX_LENGTH);

const groupName = z.string().trim().min(1, 'Group name is required').max(GROUP_NAME_MAX_LENGTH);

/**
 * Trần số thành viên nằm cả ở đây lẫn trong service: schema chặn một request khổng lồ trước
 * khi nó chạm database, service chặn nhóm đã đông rồi còn thêm người.
 */
const memberIds = z.array(objectId).min(1, 'Pick at least one member').max(GROUP_MAX_PARTICIPANTS);

const openConversationSchema = z.object({
  recipientId: objectId,
  contextType: z.enum(CONVERSATION_CONTEXTS).optional(),
  contextRef: objectId.optional(),
}).refine(
  (data) => !data.contextType || data.contextType === ConversationContext.DIRECT || Boolean(data.contextRef),
  // Ngữ cảnh không có id là ngữ cảnh không kiểm được: service sẽ không biết tra lịch đặt nào
  // để xác nhận hai người này thực sự là hai bên của nó.
  { message: 'contextRef is required for this context type', path: ['contextRef'] }
);

const createGroupSchema = z.object({ name: groupName, memberIds });

const updateGroupSchema = z.object({ name: groupName });

const addMembersSchema = z.object({ memberIds });

/** Thân tin nhắn khi id hội thoại đã nằm trên URL. */
const sendMessageBodySchema = z.object({ body: messageBody });

/** Cùng luật, nhưng qua WebSocket thì id hội thoại phải đi kèm trong payload. */
const sendMessageSchema = sendMessageBodySchema.extend({ conversationId: objectId });

const markReadSchema = z.object({ conversationId: objectId });

const typingSchema = z.object({
  conversationId: objectId,
  isTyping: z.boolean().default(true),
});

const conversationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  contextType: z.enum(CONVERSATION_CONTEXTS).optional(),
  type: z.enum(CONVERSATION_TYPES).optional(),
});

const messageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = {
  openConversationSchema, createGroupSchema, updateGroupSchema, addMembersSchema,
  sendMessageBodySchema, sendMessageSchema,
  markReadSchema, typingSchema, conversationQuerySchema, messageQuerySchema,
};
