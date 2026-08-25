/**
 * Loại thông báo in-app.
 *
 * Mỗi loại ứng với một sự kiện **nhạy cảm thời gian**: biết muộn là mất trận
 * hoặc mất tiền. Sự kiện chỉ để tham khảo (ai đó xem sân, đội có thành viên mới)
 * không nằm ở đây — thêm vào chỉ làm chuông kêu tới mức người dùng tắt hẳn.
 */
const NotificationType = {
  BOOKING_CREATED: 'booking_created',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  MATCH_REQUEST_RECEIVED: 'match_request_received',
  MATCH_REQUEST_ANSWERED: 'match_request_answered',
  MATCH_RESULT_SUBMITTED: 'match_result_submitted',
  INVOICE_ISSUED: 'invoice_issued',
  INVOICE_PAID: 'invoice_paid',
  /**
   * Chỉ bắn khi người nhận **không có thiết bị nào đang kết nối** — người đang mở ứng dụng
   * đã thấy tin nhắn hiện ra rồi, thêm một thông báo nữa là kêu hai lần cho cùng một việc.
   */
  CHAT_MESSAGE: 'chat_message',
};

const NOTIFICATION_TYPES = Object.values(NotificationType);

/** Thông báo cũ hơn ngần này tự biến mất — hộp thư không được phình vô hạn. */
const NOTIFICATION_TTL_DAYS = 90;

module.exports = { NotificationType, NOTIFICATION_TYPES, NOTIFICATION_TTL_DAYS };
