const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const env = require('../config/env');
const { getRedisClient } = require('../config/redis');
const authenticateSocket = require('./auth');
const registerHandlers = require('./handlers');
const { setIo } = require('./emitter');
const logger = require('../utils/logger');

/**
 * Gắn WebSocket vào đúng HTTP server đang phục vụ REST — một cổng, một chứng chỉ TLS,
 * một dòng cấu hình proxy. Mở cổng riêng cho realtime là thêm một thứ nữa phải mở
 * trên mọi môi trường mà không đổi lại được gì.
 */
const createSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  /**
   * Bộ nhớ trong của socket.io chỉ biết những kết nối của **chính tiến trình này**. Chạy hai
   * instance backend sau load balancer mà không có adapter thì hai người ngồi trên hai instance
   * khác nhau không nhận được tin của nhau — lỗi chỉ xuất hiện khi lên production, đúng lúc
   * khó tìm nhất. Redis đã có sẵn cho cache và rate limit nên đây là chi phí gần như bằng 0.
   */
  const pubClient = getRedisClient().duplicate();
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.use(authenticateSocket);
  io.on('connection', (socket) => {
    registerHandlers(socket);
    logger.info(`Socket connected: ${socket.data.user.id}`);
  });

  setIo(io);
  return io;
};

module.exports = createSocketServer;
