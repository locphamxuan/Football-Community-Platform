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
  // Giới hạn cao để test HTTP không dính rate limit
  RATE_LIMIT_MAX: '10000',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] = value;
}
