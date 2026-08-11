const winston = require('winston');
const env = require('../config/env');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), json()),
  transports: [
    new winston.transports.Console({
      // Test cố tình bắn lỗi để kiểm tra nhánh xử lý; in ra chỉ làm nhiễu kết quả
      silent: env.NODE_ENV === 'test',
      format:
        env.NODE_ENV === 'production'
          ? combine(timestamp(), json())
          : combine(colorize(), simple()),
    }),
  ],
});

module.exports = logger;
