jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/notification.service');

const request = require('supertest');
const app = require('../../src/app');
const notificationService = require('../../src/services/notification.service');
const { asUser, USER_ID } = require('../helpers/auth');

const NOTIFICATION_ID = '000000000000000000000050';

beforeEach(() => {
  notificationService.getMyNotifications.mockResolvedValue({
    notifications: [], total: 0, page: 1, limit: 10,
  });
  notificationService.countUnread.mockResolvedValue(0);
});

describe('toàn bộ /api/v1/notifications cần đăng nhập', () => {
  it.each([
    ['get', '/api/v1/notifications'],
    ['get', '/api/v1/notifications/unread-count'],
    ['patch', '/api/v1/notifications/read-all'],
    ['patch', `/api/v1/notifications/${NOTIFICATION_ID}/read`],
  ])('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/notifications', () => {
  it('trả danh sách, số chưa đọc và phân trang trong một lần gọi', async () => {
    notificationService.getMyNotifications.mockResolvedValue({
      notifications: [{ _id: NOTIFICATION_ID, title: 'Lịch đặt đã được xác nhận' }],
      total: 1, page: 1, limit: 10,
    });
    notificationService.countUnread.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/notifications').set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(1);
    expect(res.body.data.unreadCount).toBe(1);
    expect(res.body.meta.pagination.total).toBe(1);
  });

  it('chuyển bộ lọc xuống service', async () => {
    await request(app)
      .get('/api/v1/notifications')
      .query({ unread: 'true', type: 'invoice_issued', limit: 5 })
      .set(asUser());

    expect(notificationService.getMyNotifications).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ unread: 'true', type: 'invoice_issued', limit: 5 })
    );
  });

  it.each([
    ['loại thông báo không tồn tại', { type: 'field_liked' }],
    ['unread không phải true/false', { unread: 'maybe' }],
    ['limit vượt trần', { limit: 500 }],
  ])('trả 400 khi %s', async (_label, query) => {
    const res = await request(app).get('/api/v1/notifications').query(query).set(asUser());

    expect(res.status).toBe(400);
    expect(notificationService.getMyNotifications).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/notifications/unread-count', () => {
  it('trả số chưa đọc của chính người gọi', async () => {
    notificationService.countUnread.mockResolvedValue(9);

    const res = await request(app).get('/api/v1/notifications/unread-count').set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(9);
    expect(notificationService.countUnread).toHaveBeenCalledWith(USER_ID);
  });
});

describe('đánh dấu đã đọc', () => {
  it('đánh dấu một thông báo', async () => {
    notificationService.markAsRead.mockResolvedValue({ _id: NOTIFICATION_ID, readAt: new Date() });

    const res = await request(app)
      .patch(`/api/v1/notifications/${NOTIFICATION_ID}/read`)
      .set(asUser());

    expect(res.status).toBe(200);
    expect(notificationService.markAsRead).toHaveBeenCalledWith(USER_ID, NOTIFICATION_ID);
  });

  it('đánh dấu tất cả', async () => {
    notificationService.markAllAsRead.mockResolvedValue({ modified: 4 });

    const res = await request(app).patch('/api/v1/notifications/read-all').set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data.modified).toBe(4);
    expect(notificationService.markAllAsRead).toHaveBeenCalledWith(USER_ID);
  });

  it('/read-all không bị nuốt bởi /:id/read', async () => {
    notificationService.markAllAsRead.mockResolvedValue({ modified: 0 });

    await request(app).patch('/api/v1/notifications/read-all').set(asUser());

    expect(notificationService.markAsRead).not.toHaveBeenCalled();
  });
});
