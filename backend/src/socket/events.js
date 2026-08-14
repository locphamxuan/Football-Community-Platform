/**
 * Tên sự kiện WebSocket — từ vựng chung giữa backend, web và mobile.
 *
 * Gõ chuỗi thẳng ở hai đầu là cách chắc chắn nhất để một bên đổi tên và bên kia im lặng
 * không nhận được gì: sai tên sự kiện không gây lỗi, chỉ gây mất tin nhắn.
 * `shared/types.ts` chép lại đúng danh sách này cho phía client.
 */

/** Client gửi lên server. */
const ClientEvent = {
  SEND_MESSAGE: 'message:send',
  MARK_READ: 'conversation:read',
  TYPING: 'conversation:typing',
};

/** Server đẩy xuống client. */
const ServerEvent = {
  NEW_MESSAGE: 'message:new',
  /** Người kia vừa đọc tới đâu — để hiện "đã xem". */
  READ: 'conversation:read',
  TYPING: 'conversation:typing',
  /** Lỗi của một sự kiện cụ thể; không đóng kết nối. */
  ERROR: 'chat:error',
};

module.exports = { ClientEvent, ServerEvent };
