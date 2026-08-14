/**
 * Cửa duy nhất để tầng service đẩy realtime.
 *
 * Service không được `require` thẳng `socket/index.js`: tầng socket đã require service để
 * xử lý sự kiện, nên chiều ngược lại tạo vòng require và một trong hai module nhận về
 * object rỗng. Module này chỉ giữ tham chiếu `io`, không require gì của socket cả.
 *
 * Chưa có `io` (test, hoặc tiến trình chỉ chạy REST) thì mọi hàm ở đây im lặng không làm gì —
 * realtime là lớp báo sớm, mất nó không được làm hỏng việc lưu tin nhắn.
 */
let io = null;

const setIo = (instance) => { io = instance; };

/**
 * Mỗi người có một phòng riêng và mọi thiết bị của họ vào chung phòng đó.
 *
 * Không dùng phòng theo hội thoại: người dùng đang ở màn hình khác vẫn phải thấy chấm đỏ
 * khi có tin mới, mà phòng theo hội thoại chỉ tới được người đang mở đúng hội thoại ấy.
 */
const userRoom = (userId) => `user:${userId.toString()}`;

const emitToUsers = (userIds, event, payload) => {
  if (!io) return;
  io.to(userIds.map(userRoom)).emit(event, payload);
};

/**
 * Người này có thiết bị nào đang kết nối không — dùng để quyết định có cần đẩy thông báo
 * hay không. Với redis adapter, hàm này đếm trên toàn bộ cụm chứ không chỉ instance hiện tại.
 */
const isOnline = async (userId) => {
  if (!io) return false;
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  return sockets.length > 0;
};

module.exports = { setIo, userRoom, emitToUsers, isOnline };
