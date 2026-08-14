const chatService = require('../services/chat.service');
const { ClientEvent, ServerEvent } = require('./events');
const { userRoom } = require('./emitter');
const { sendMessageSchema, markReadSchema, typingSchema } = require('../validations/chat.validation');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');
const logger = require('../utils/logger');

/**
 * Payload của một sự kiện WebSocket đi qua đúng schema mà route HTTP dùng.
 *
 * Không có `middleware/validate.js` ở đây vì không có `req`/`res` — nhưng bỏ kiểm tra thì
 * đường WebSocket thành cửa sau đi vòng qua mọi ràng buộc mà đường HTTP bắt buộc.
 */
const parsePayload = (schema, payload) => {
  const result = schema.safeParse(payload || {});
  if (!result.success) {
    throw new AppError(
      result.error.issues[0]?.message || 'Invalid payload',
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR
    );
  }
  return result.data;
};

/**
 * Bọc một handler sự kiện.
 *
 * Một sự kiện WebSocket không có response như HTTP, nên lỗi ném ra ở đây mặc định rơi vào
 * `unhandledRejection` và giết cả tiến trình (xem `server.js`) — trong khi phía client chỉ
 * thấy tin nhắn của mình biến mất không dấu vết. Nên mọi handler trả lời hai đường: `ack`
 * cho đúng lời gọi vừa rồi, và sự kiện `chat:error` cho client không dùng ack.
 */
const handle = (socket, fn) => async (payload, ack) => {
  try {
    const data = await fn(payload);
    if (typeof ack === 'function') ack({ success: true, data: data ?? null });
  } catch (err) {
    // Lỗi ngoài dự kiến không được lộ chi tiết ra ngoài, nhưng phải vào log.
    const isKnown = err.isOperational === true;
    if (!isKnown) logger.error('Socket handler failed:', err.message);

    const response = {
      success: false,
      message: isKnown ? err.message : 'Something went wrong',
      code: isKnown ? err.code : ErrorCode.INTERNAL_ERROR,
    };
    if (typeof ack === 'function') ack(response);
    socket.emit(ServerEvent.ERROR, { message: response.message, code: response.code });
  }
};

const registerHandlers = (socket) => {
  const userId = socket.data.user.id;

  // Mọi thiết bị của một người vào chung một phòng, nên tin nhắn tới được cả điện thoại
  // lẫn máy tính mà không cần biết họ đang mở màn hình nào.
  socket.join(userRoom(userId));

  socket.on(ClientEvent.SEND_MESSAGE, handle(socket, async (payload) => {
    const { conversationId, body } = parsePayload(sendMessageSchema, payload);
    const { message } = await chatService.sendMessage(userId, conversationId, body);
    return { message };
  }));

  socket.on(ClientEvent.MARK_READ, handle(socket, (payload) => {
    const { conversationId } = parsePayload(markReadSchema, payload);
    return chatService.markRead(userId, conversationId);
  }));

  socket.on(ClientEvent.TYPING, handle(socket, (payload) => {
    const { conversationId, isTyping } = parsePayload(typingSchema, payload);
    return chatService.notifyTyping(userId, conversationId, isTyping);
  }));
};

module.exports = registerHandlers;
