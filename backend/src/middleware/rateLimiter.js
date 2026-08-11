const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const env = require('../config/env');
const { getRedisClient } = require('../config/redis');
const { sendError } = require('../utils/ApiResponse');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const makeHandler = (message) => (_req, res) =>
  sendError(res, message, HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS);

/**
 * Bộ đếm nằm trên Redis để mọi instance backend dùng chung một hạn mức và
 * hạn mức không bị xoá sạch mỗi lần deploy. Trả về `undefined` khi tắt Redis —
 * express-rate-limit tự rơi về bộ đếm trong RAM của tiến trình.
 */
const createStore = (prefix) => {
  if (!env.RATE_LIMIT_USE_REDIS) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args) => getRedisClient().call(...args),
  });
};

const createLimiter = ({ prefix, windowMs, max, message, skip }) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  // Redis chết thì cho request đi tiếp, không biến sự cố cache thành lỗi 500
  passOnStoreError: true,
  store: createStore(prefix),
  handler: makeHandler(message),
  skip,
});

/** Trần chung cho toàn bộ /api — chặn quét và bot, không chạm tới người dùng thật. */
const globalLimiter = createLimiter({
  prefix: 'global',
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: 'Too many requests, please try again later.',
});

/**
 * Ghi tốn kém hơn đọc rất nhiều (tạo booking, đổi gói, nhập kết quả) và là nơi
 * kẻ xấu spam. Đọc đi qua limiter này mà không bị tính lượt.
 */
const writeLimiter = createLimiter({
  prefix: 'write',
  windowMs: 60 * 1000,
  max: env.RATE_LIMIT_WRITE_MAX,
  message: 'Too many write requests, please slow down.',
  skip: (req) => READ_METHODS.includes(req.method),
});

/** Đăng nhập, đăng ký, quên mật khẩu — ngưỡng thấp để chặn dò mật khẩu. */
const authLimiter = createLimiter({
  prefix: 'auth',
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_AUTH_MAX,
  message: 'Too many attempts, please try again in 15 minutes.',
});

/** Upload ảnh lên Cloudinary tốn băng thông và hạn mức tài khoản. */
const uploadLimiter = createLimiter({
  prefix: 'upload',
  windowMs: 60 * 1000,
  max: env.RATE_LIMIT_UPLOAD_MAX,
  message: 'Too many uploads, please try again in a minute.',
});

module.exports = { globalLimiter, writeLimiter, authLimiter, uploadLimiter };
