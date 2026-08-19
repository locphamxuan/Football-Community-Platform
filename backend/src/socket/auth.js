const cookie = require('cookie');
const { verifyAccessToken } = require('../utils/jwt');
const { cache, CacheKeys } = require('../config/redis');
const Role = require('../constants/roles');

/**
 * Chặn cửa cho WebSocket — cùng luật với `middleware/authenticate.js`, khác chỗ lấy token.
 *
 * Mobile gửi token qua `handshake.auth`: trình duyệt không cho đặt header tuỳ ý trên một kết
 * nối WebSocket, nên header chỉ tới được server ở giai đoạn polling và biến mất đúng lúc
 * client nâng cấp lên WebSocket, còn `auth` thì socket.io gửi lại nguyên vẹn ở mọi transport.
 * Web không còn giữ token nào ở phía JS để đặt vào `auth` — access token nằm trong cookie
 * `httpOnly`, và cookie thì trình duyệt tự đính kèm ở request bắt tay ban đầu (`withCredentials`),
 * kể cả trên WebSocket. Nên: có `auth.token` (mobile) thì dùng nó, không thì đọc cookie.
 *
 * Xác thực **một lần lúc bắt tay**, không kiểm lại mỗi tin nhắn: kết nối sống lâu hơn access
 * token, nên đánh đổi ở đây là một phiên đã mở vẫn chạy tiếp tới khi client ngắt. Client tự
 * kết nối lại bằng token mới sau mỗi lần refresh; ai bị logout thì lần bắt tay sau bị chặn.
 */
const getCookieToken = (socket) => {
  const header = socket.handshake.headers?.cookie;
  if (!header) return null;
  return cookie.parse(header).accessToken || null;
};

const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth?.token || getCookieToken(socket);
  if (!token) return next(new Error('Authentication required'));

  try {
    const payload = verifyAccessToken(token);

    if (await cache.exists(CacheKeys.blacklistedToken(payload.jti))) {
      return next(new Error('Token has been revoked'));
    }

    // Kết nối này chỉ phục vụ chat, mà quản trị viên nền tảng không tham gia chat
    // (cùng luật với `denyRoles` ở `chat.routes.js`). Từ chối ngay lúc bắt tay chứ không
    // cho kết nối rồi im lặng bỏ qua mọi sự kiện — client phải biết là mình bị từ chối.
    if (payload.roles?.includes(Role.ADMIN)) {
      return next(new Error('Chat is not available for this account'));
    }

    socket.data.user = { id: payload.sub, email: payload.email, roles: payload.roles };
    return next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
};

module.exports = authenticateSocket;
