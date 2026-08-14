const { verifyAccessToken } = require('../utils/jwt');
const { cache, CacheKeys } = require('../config/redis');

/**
 * Chặn cửa cho WebSocket — cùng luật với `middleware/authenticate.js`, khác chỗ lấy token.
 *
 * Token đi trong `handshake.auth` chứ không phải header `Authorization`: trình duyệt không
 * cho đặt header tuỳ ý trên một kết nối WebSocket, nên header chỉ tới được server ở giai đoạn
 * polling và sẽ biến mất đúng lúc client nâng cấp lên WebSocket. `auth` thì socket.io gửi
 * lại nguyên vẹn ở mọi transport, kể cả sau khi tự kết nối lại.
 *
 * Xác thực **một lần lúc bắt tay**, không kiểm lại mỗi tin nhắn: kết nối sống lâu hơn access
 * token, nên đánh đổi ở đây là một phiên đã mở vẫn chạy tiếp tới khi client ngắt. Client tự
 * kết nối lại bằng token mới sau mỗi lần refresh; ai bị logout thì lần bắt tay sau bị chặn.
 */
const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const payload = verifyAccessToken(token);

    if (await cache.exists(CacheKeys.blacklistedToken(payload.jti))) {
      return next(new Error('Token has been revoked'));
    }

    socket.data.user = { id: payload.sub, email: payload.email, roles: payload.roles };
    return next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
};

module.exports = authenticateSocket;
