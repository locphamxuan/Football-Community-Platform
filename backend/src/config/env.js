require('dotenv').config();

const required = (key) => {
  const val = process.env[key];
  if (!val) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
  return val;
};

const optional = (key, defaultVal = '') => process.env[key] ?? defaultVal;
const number = (key, defaultVal) => parseInt(optional(key, defaultVal), 10);
const flag = (key, defaultVal) => optional(key, defaultVal) === 'true';

const nodeEnv = optional('NODE_ENV', 'development');

const env = {
  NODE_ENV: nodeEnv,
  PORT: number('PORT', '5000'),
  CLIENT_URL: optional('CLIENT_URL', 'http://localhost:3000'),

  MONGODB_URI: required('MONGODB_URI'),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),

  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),
  REDIS_PASSWORD: optional('REDIS_PASSWORD'),

  CLOUDINARY_CLOUD_NAME: required('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: required('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: required('CLOUDINARY_API_SECRET'),

  EMAIL_HOST: optional('EMAIL_HOST', 'smtp.gmail.com'),
  EMAIL_PORT: number('EMAIL_PORT', '587'),
  EMAIL_USER: required('EMAIL_USER'),
  EMAIL_PASS: required('EMAIL_PASS'),
  EMAIL_FROM: optional('EMAIL_FROM', 'Football Platform <noreply@footballplatform.com>'),

  // ── Rate limit ──────────────────────────────────────────────────────────────
  // Cửa sổ chung cho limiter toàn cục; auth/upload/ghi có cửa sổ riêng cố định.
  RATE_LIMIT_WINDOW_MS: number('RATE_LIMIT_WINDOW_MS', '900000'),
  RATE_LIMIT_MAX: number('RATE_LIMIT_MAX', '300'),
  RATE_LIMIT_AUTH_MAX: number('RATE_LIMIT_AUTH_MAX', '10'),
  RATE_LIMIT_WRITE_MAX: number('RATE_LIMIT_WRITE_MAX', '60'),
  RATE_LIMIT_UPLOAD_MAX: number('RATE_LIMIT_UPLOAD_MAX', '20'),
  // Đếm lượt trên Redis để nhiều instance dùng chung hạn mức. Tắt trong test:
  // test không có Redis và cũng cần bộ đếm reset theo từng file.
  RATE_LIMIT_USE_REDIS: flag('RATE_LIMIT_USE_REDIS', nodeEnv === 'test' ? 'false' : 'true'),

  // ── Chat ────────────────────────────────────────────────────────────────────
  // Số tin nhắn tối đa một tài khoản gửi được trong 60 giây. Trần này nằm trong service
  // chứ không phải middleware, vì tin nhắn qua WebSocket không đi qua tầng HTTP nào cả.
  CHAT_RATE_MAX: number('CHAT_RATE_MAX', '30'),
};

module.exports = env;
