/**
 * Redis giả chạy hoàn toàn trong RAM.
 *
 * Test HTTP không có Redis thật, mà `authenticate` lại hỏi cache xem token đã bị
 * thu hồi chưa. Thay vì mock từng lời gọi, các file test nạp module này:
 *
 *   jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
 *
 * `CacheKeys`/`CacheTTL` lấy từ module thật để không phải chép lại và không bao
 * giờ lệch nhau.
 */
const { CacheKeys, CacheTTL } = jest.requireActual('../../src/config/redis');

const store = new Map();

const cache = {
  get: async (key) => (store.has(key) ? store.get(key) : null),

  set: async (key, value) => {
    store.set(key, String(value));
    return 'OK';
  },

  del: async (...keys) => keys.filter((key) => store.delete(key)).length,

  getJSON: async (key) => {
    const raw = await cache.get(key);
    return raw ? JSON.parse(raw) : null;
  },

  setJSON: (key, value, ttlSeconds) => cache.set(key, JSON.stringify(value), ttlSeconds),

  exists: async (key) => store.has(key),
};

/** Xoá sạch giữa các test để một test không thấy dữ liệu của test trước. */
const resetCache = () => store.clear();

module.exports = {
  cache,
  CacheKeys,
  CacheTTL,
  resetCache,
  getRedisStatus: () => 'ready',
  getRedisClient: () => { throw new Error('Test không được mở kết nối Redis thật'); },
  connectRedis: async () => {},
  disconnectRedis: async () => {},
};
