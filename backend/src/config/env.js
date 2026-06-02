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

const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '5000'), 10),
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
  EMAIL_PORT: parseInt(optional('EMAIL_PORT', '587'), 10),
  EMAIL_USER: required('EMAIL_USER'),
  EMAIL_PASS: required('EMAIL_PASS'),
  EMAIL_FROM: optional('EMAIL_FROM', 'Football Platform <noreply@footballplatform.com>'),

  RATE_LIMIT_WINDOW_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  RATE_LIMIT_MAX: parseInt(optional('RATE_LIMIT_MAX', '100'), 10),
};

module.exports = env;
