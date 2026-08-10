module.exports = {
  testEnvironment: 'node',
  // Nạp biến môi trường giả trước khi bất kỳ module nào require config/env —
  // config/env gọi process.exit(1) nếu thiếu biến bắt buộc, kể cả trong test.
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/config/**'],
  clearMocks: true,
};
