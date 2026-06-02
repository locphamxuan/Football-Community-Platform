const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let client;

const getRedisClient = () => {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    client.on('connect', () => logger.info('Redis connected'));
    client.on('error', (err) => logger.error('Redis error:', err.message));
    client.on('close', () => logger.warn('Redis connection closed'));
  }
  return client;
};

const connectRedis = async () => {
  await getRedisClient().connect();
};

const disconnectRedis = async () => {
  if (client) {
    await client.quit();
    logger.info('Redis disconnected gracefully');
  }
};

// ---- Cache helpers ----
const cache = {
  get: (key) => getRedisClient().get(key),

  set: async (key, value, ttlSeconds) => {
    if (ttlSeconds) {
      await getRedisClient().setex(key, ttlSeconds, value);
    } else {
      await getRedisClient().set(key, value);
    }
  },

  del: (...keys) => keys.length > 0 ? getRedisClient().del(...keys) : Promise.resolve(),

  getJSON: async (key) => {
    const data = await getRedisClient().get(key);
    return data ? JSON.parse(data) : null;
  },

  setJSON: (key, value, ttlSeconds) =>
    cache.set(key, JSON.stringify(value), ttlSeconds),

  exists: async (key) => {
    const result = await getRedisClient().exists(key);
    return result === 1;
  },

  incr: (key) => getRedisClient().incr(key),
  expire: (key, ttl) => getRedisClient().expire(key, ttl),
};

const CacheKeys = {
  field: (id) => `field:${id}`,
  fieldSearch: (hash) => `fields:search:${hash}`,
  fieldAvailability: (fieldId, date) => `field:availability:${fieldId}:${date}`,
  popularFields: (city) => `fields:popular:${city}`,
  team: (id) => `team:${id}`,
  userSession: (userId) => `user:session:${userId}`,
  blacklistedToken: (jti) => `blacklist:token:${jti}`,
  unreadNotifications: (userId) => `user:unread:${userId}`,
};

const CacheTTL = {
  FIELD: 600,            // 10 min
  FIELD_SEARCH: 300,     // 5 min
  FIELD_AVAILABILITY: 30,// 30 sec
  POPULAR: 3600,         // 1 hour
  TEAM: 600,             // 10 min
  USER_SESSION: 900,     // 15 min (same as access token)
  AI_REPORT: 3600,       // 1 hour
};

module.exports = { connectRedis, disconnectRedis, getRedisClient, cache, CacheKeys, CacheTTL };
