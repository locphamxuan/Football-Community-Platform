const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;
const TOKEN_SALT_ROUNDS = 10;

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
const comparePassword = (password, hash) => bcrypt.compare(password, hash);

/**
 * bcrypt chỉ đọc 72 byte đầu của input. Refresh token là JWT ~232 byte và
 * 72 byte đầu (header + phần đầu payload) giống nhau ở mọi token của cùng một
 * user — nếu hash trực tiếp thì mọi token của user đó cho ra hash khớp nhau,
 * làm phát hiện token reuse mất tác dụng. SHA-256 trước để nén toàn bộ token
 * vào 64 byte hex, nằm gọn trong giới hạn của bcrypt.
 */
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Salt thấp hơn cho token hash (tốc độ quan trọng hơn bảo mật cao)
const hashToken = (token) => bcrypt.hash(digest(token), TOKEN_SALT_ROUNDS);
const compareToken = (token, hash) => bcrypt.compare(digest(token), hash);

module.exports = { hashPassword, comparePassword, hashToken, compareToken };
