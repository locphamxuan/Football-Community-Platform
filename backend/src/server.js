const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { connectRedis, disconnectRedis } = require('./config/redis');
const { verifyEmailConnection } = require('./config/email');
const createSocketServer = require('./socket');
const logger = require('./utils/logger');

const server = http.createServer(app);
let io;

const start = async () => {
  try {
    await connectDatabase();
    await connectRedis();
    await verifyEmailConnection();

    // Sau `connectRedis`: adapter của socket.io nhân bản client Redis, mà nhân bản một
    // client chưa từng kết nối thì bản sao cũng không có kết nối để mà nhân.
    io = createSocketServer(server);

    server.listen(env.PORT, () => {
      logger.info(`🚀 Server running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`📡 API: http://localhost:${env.PORT}/api/v1`);
      logger.info(`💬 WebSocket: ws://localhost:${env.PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  logger.info(`\n${signal} — shutting down gracefully...`);
  // Đóng socket trước: `server.close()` chỉ chờ request HTTP kết thúc, còn một kết nối
  // WebSocket thì không bao giờ tự kết thúc — bỏ qua bước này là luôn phải chờ hết 10 giây.
  if (io) await io.close();
  server.close(async () => {
    await disconnectDatabase();
    await disconnectRedis();
    logger.info('Server shut down cleanly');
    process.exit(0);
  });
  // Bắt buộc thoát sau 10s
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => { logger.error('uncaughtException:', err);  process.exit(1); });
process.on('unhandledRejection', (err) => { logger.error('unhandledRejection:', err); process.exit(1); });

start();

module.exports = server;
