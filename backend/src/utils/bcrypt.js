const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
const comparePassword = (password, hash) => bcrypt.compare(password, hash);

// Salt thấp hơn cho token hash (tốc độ quan trọng hơn bảo mật cao)
const hashToken = (token) => bcrypt.hash(token, 10);
const compareToken = (token, hash) => bcrypt.compare(token, hash);

module.exports = { hashPassword, comparePassword, hashToken, compareToken };
