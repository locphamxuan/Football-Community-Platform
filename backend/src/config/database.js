const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

const connectDatabase = async () => {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => logger.info('✅ MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
};

const disconnectDatabase = async () => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
};

module.exports = { connectDatabase, disconnectDatabase };
