const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { sendError } = require('../utils/ApiResponse');
const HttpStatus = require('../constants/httpStatus');

const makeHandler = (message) => (_req, res) =>
  sendError(res, message, HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS');

const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler('Too many requests, please try again later.'),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler('Too many attempts, please try again in 15 minutes.'),
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { globalLimiter, authLimiter, uploadLimiter };
