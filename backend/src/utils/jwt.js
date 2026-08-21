const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

// Ký/xác thực đều ghim cứng HS256 — không để jsonwebtoken tự suy luận thuật toán
// từ header của token, vốn là đường mở ra tấn công đổi thuật toán (alg confusion).
const JWT_ALGORITHM = 'HS256';

const generateAccessToken = (userId, email, roles) => {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: userId, email, roles, jti },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN, algorithm: JWT_ALGORITHM }
  );
  return { token, jti };
};

const generateRefreshToken = (userId) => {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: userId, jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN, algorithm: JWT_ALGORITHM }
  );
  return { token, jti };
};

const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [JWT_ALGORITHM] });
const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: [JWT_ALGORITHM] });

// Chuyển "7d", "15m" thành ms
const parseExpiry = (str) => {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 0;
  const [, val, unit] = match;
  return Number(val) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[unit];
};

const getTokenExpiry = (expiresIn) => new Date(Date.now() + parseExpiry(expiresIn));

module.exports = { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken, getTokenExpiry, parseExpiry };
