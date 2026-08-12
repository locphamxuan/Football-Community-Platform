const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let client;
let ready = false;

const getRedisClient = () => {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    client.on('ready', () => { ready = true; logger.info('Redis ready'); });
    client.on('error', (err) => { ready = false; logger.error('Redis error:', err.message); });
    client.on('close', () => { ready = false; logger.warn('Redis connection closed'); });
  }
  return client;
};

/**
 * `lazyConnect` để dành quyền mở kết nối cho hàm này, nhưng `rate-limit-redis` nạp
 * script Lua ngay khi middleware được tạo — tức là lúc `require('./app')`, trước khi
 * `server.js` gọi tới đây — và lệnh đầu tiên đó đã tự mở kết nối. Gọi `connect()` lần
 * nữa ném "Redis is already connecting/connected" và server chết ngay lúc khởi động.
 */
const connectRedis = async () => {
  const redis = getRedisClient();
  if (redis.status === 'wait' || redis.status === 'end') {
    await redis.connect();
    return;
  }
  // Đang kết nối dở: `ping` xếp hàng cho tới khi sẵn sàng, và xác nhận Redis trả lời thật.
  if (redis.status !== 'ready') await redis.ping();
};

const disconnectRedis = async () => {
  if (client) {
    await client.quit();
    ready = false;
    logger.info('Redis disconnected gracefully');
  }
};

/** Trạng thái Redis cho health check — không mở kết nối mới nếu chưa có. */
const getRedisStatus = () => {
  if (!client) return 'disconnected';
  return ready ? 'ready' : client.status;
};

/**
 * Redis ở đây là tầng tăng tốc, không phải nguồn sự thật: MongoDB vẫn trả lời
 * được mọi câu hỏi mà cache trả lời. Nên một sự cố Redis chỉ được làm chậm
 * request, không được làm hỏng nó — mọi thao tác đi qua `safe` và rơi về giá
 * trị mặc định khi lỗi.
 *
 * Đánh đổi: `exists` trả về false khi Redis chết, nên access token đã logout
 * vẫn dùng được cho tới khi hết hạn (tối đa JWT_ACCESS_EXPIRES_IN). Chấp nhận
 * được vì phương án còn lại là chặn toàn bộ người dùng khi Redis chớp tắt.
 */
const safe = async (label, operation, fallback) => {
  try {
    return await operation();
  } catch (err) {
    logger.error(`Redis ${label} failed:`, err.message);
    return fallback;
  }
};

const cache = {
  get: (key) => safe('get', () => getRedisClient().get(key), null),

  set: (key, value, ttlSeconds) => safe('set', () => (
    ttlSeconds
      ? getRedisClient().setex(key, ttlSeconds, value)
      : getRedisClient().set(key, value)
  ), null),

  del: (...keys) => (
    keys.length > 0
      ? safe('del', () => getRedisClient().del(...keys), 0)
      : Promise.resolve(0)
  ),

  getJSON: async (key) => {
    const data = await cache.get(key);
    if (!data) return null;
    // Giá trị hỏng trong cache không được làm vỡ request — bỏ qua như cache miss
    return safe('parse', () => JSON.parse(data), null);
  },

  setJSON: (key, value, ttlSeconds) => cache.set(key, JSON.stringify(value), ttlSeconds),

  exists: async (key) => {
    const result = await safe('exists', () => getRedisClient().exists(key), 0);
    return result === 1;
  },
};

const CacheKeys = {
  field: (id) => `field:${id}`,
  fieldAvailability: (fieldId, date) => `field:availability:${fieldId}:${date}`,
  blacklistedToken: (jti) => `blacklist:token:${jti}`,
  unreadNotifications: (userId) => `notif:unread:${userId}`,
};

const CacheTTL = {
  FIELD: 600,             // 10 phút
  FIELD_AVAILABILITY: 30, // 30 giây — lịch trống đổi liên tục
  // Chuông thông báo được hỏi trên mọi trang; đếm lại trong Mongo mỗi lần là lãng phí.
  // Cache bị xoá ngay khi có thông báo mới hoặc khi đánh dấu đã đọc, nên TTL chỉ là lưới an toàn.
  UNREAD_NOTIFICATIONS: 300,
};

module.exports = {
  connectRedis, disconnectRedis, getRedisClient, getRedisStatus,
  cache, CacheKeys, CacheTTL,
};
