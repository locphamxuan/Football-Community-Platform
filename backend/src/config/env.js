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

/** JWT secret yếu (rỗng/ngắn) không bị `required()` bắt vì nó chỉ kiểm tra non-empty. */
const requiredSecret = (key, minLength = 32) => {
  const val = required(key);
  if (val.length < minLength) {
    console.error(`${key} is too short (${val.length} chars) — need at least ${minLength} for a safe JWT signing secret`);
    process.exit(1);
  }
  return val;
};

const nodeEnv = optional('NODE_ENV', 'development');

const env = {
  NODE_ENV: nodeEnv,
  PORT: number('PORT', '5000'),
  CLIENT_URL: optional('CLIENT_URL', 'http://localhost:3000'),

  MONGODB_URI: required('MONGODB_URI'),

  JWT_ACCESS_SECRET: requiredSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requiredSecret('JWT_REFRESH_SECRET'),
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

  // ── Thanh toán (VNPay) ──────────────────────────────────────────────────────
  // Optional, không required(): server vẫn phải chạy được khi chưa cấu hình merchant
  // thật — services/billing tự báo PAYMENT_PROVIDER_UNAVAILABLE lúc gọi checkout, không
  // chặn cả server lúc khởi động vì thanh toán online không phải điều kiện tiên quyết.
  VNPAY_TMN_CODE: optional('VNPAY_TMN_CODE'),
  VNPAY_HASH_SECRET: optional('VNPAY_HASH_SECRET'),
  VNPAY_URL: optional('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
  VNPAY_RETURN_URL: optional('VNPAY_RETURN_URL', `${optional('CLIENT_URL', 'http://localhost:3000')}/owner/billing`),

  // ── Thanh toán (MoMo) ───────────────────────────────────────────────────────
  // Cùng lý do optional như VNPay ở trên. MOMO_IPN_URL phải là URL công khai gọi được từ MoMo
  // (không phải localhost khi test thật) — mặc định trỏ vào backend local chỉ để không crash
  // lúc đọc env khi chưa cấu hình.
  MOMO_PARTNER_CODE: optional('MOMO_PARTNER_CODE'),
  MOMO_ACCESS_KEY: optional('MOMO_ACCESS_KEY'),
  MOMO_SECRET_KEY: optional('MOMO_SECRET_KEY'),
  MOMO_URL: optional('MOMO_URL', 'https://test-payment.momo.vn/v2/gateway/api/create'),
  MOMO_IPN_URL: optional('MOMO_IPN_URL', `http://localhost:${number('PORT', '5000')}/webhooks/payments/momo/ipn`),
  MOMO_REDIRECT_URL: optional('MOMO_REDIRECT_URL', `${optional('CLIENT_URL', 'http://localhost:3000')}/owner/billing`),
};

module.exports = env;
