/**
 * Giá trị giả cho các biến môi trường bắt buộc.
 * Test ở đây là unit + HTTP không chạm DB, nên không cần credential thật —
 * chỉ cần config/env không thoát tiến trình khi nạp.
 */
const defaults = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/football-platform-test',
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  CLOUDINARY_CLOUD_NAME: 'test',
  CLOUDINARY_API_KEY: 'test',
  CLOUDINARY_API_SECRET: 'test',
  EMAIL_USER: 'test@example.com',
  EMAIL_PASS: 'test',
  // Giới hạn cao để test HTTP không dính rate limit. File test riêng cho rate
  // limit tự đặt lại các biến này trước khi nạp middleware.
  RATE_LIMIT_MAX: '10000',
  RATE_LIMIT_AUTH_MAX: '10000',
  RATE_LIMIT_WRITE_MAX: '10000',
  RATE_LIMIT_UPLOAD_MAX: '10000',
  // Bộ đếm rate limit chạy trong RAM: test không có Redis
  RATE_LIMIT_USE_REDIS: 'false',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] = value;
}
