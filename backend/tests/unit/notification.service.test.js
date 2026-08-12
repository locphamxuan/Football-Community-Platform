jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/models/Notification', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  updateMany: jest.fn(),
}));

const Notification = require('../../src/models/Notification');
const { cache, CacheKeys, resetCache } = require('../helpers/fakeRedis');
const notificationService = require('../../src/services/notification.service');
const { NotificationType } = require('../../src/constants/notifications');

const USER_ID = '000000000000000000000001';
const OTHER_ID = '000000000000000000000002';
const NOTIFICATION_ID = '000000000000000000000050';

const payload = {
  type: NotificationType.BOOKING_CONFIRMED,
  title: 'Lịch đặt đã được xác nhận',
  body: 'Sân Probe · 24/08/2026 18:00–20:00',
  link: '/bookings',
};

const mockQuery = (value) => ({
  skip: () => ({ limit: () => ({ sort: () => Promise.resolve(value) }) }),
});

beforeEach(() => {
  resetCache();
  Notification.create.mockResolvedValue({ _id: NOTIFICATION_ID, ...payload });
  Notification.countDocuments.mockResolvedValue(0);
});

describe('notify', () => {
  it('ghi thông báo cho người nhận', async () => {
    await notificationService.notify(USER_ID, payload);

    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
      recipient: USER_ID,
      type: NotificationType.BOOKING_CONFIRMED,
      link: '/bookings',
    }));
  });

  it('không tự bắn thông báo cho chính người vừa hành động', async () => {
    const result = await notificationService.notify(USER_ID, payload, USER_ID);

    expect(result).toBeNull();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it('vẫn bắn khi người hành động là người khác', async () => {
    await notificationService.notify(USER_ID, payload, OTHER_ID);

    expect(Notification.create).toHaveBeenCalled();
  });

  it('bỏ qua khi không có người nhận — đội chưa có quản lý chẳng hạn', async () => {
    const result = await notificationService.notify(null, payload);

    expect(result).toBeNull();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it('lỗi ghi thông báo không được ném ra ngoài — hành động gốc đã thành công rồi', async () => {
    Notification.create.mockRejectedValue(new Error('Mongo down'));

    await expect(notificationService.notify(USER_ID, payload)).resolves.toBeNull();
  });

  it('xoá cache số chưa đọc để chuông thấy thông báo mới ngay', async () => {
    await cache.set(CacheKeys.unreadNotifications(USER_ID), 3);

    await notificationService.notify(USER_ID, payload);

    expect(await cache.get(CacheKeys.unreadNotifications(USER_ID))).toBeNull();
  });
});

describe('countUnread', () => {
  it('đếm trong Mongo lần đầu rồi lưu vào cache', async () => {
    Notification.countDocuments.mockResolvedValue(4);

    const count = await notificationService.countUnread(USER_ID);

    expect(count).toBe(4);
    expect(await cache.get(CacheKeys.unreadNotifications(USER_ID))).toBe('4');
  });

  it('lần sau đọc từ cache, không hỏi Mongo nữa', async () => {
    await cache.set(CacheKeys.unreadNotifications(USER_ID), 7);

    const count = await notificationService.countUnread(USER_ID);

    expect(count).toBe(7);
    expect(Notification.countDocuments).not.toHaveBeenCalled();
  });

  it('giá trị hỏng trong cache được coi như cache miss', async () => {
    await cache.set(CacheKeys.unreadNotifications(USER_ID), 'không phải số');
    Notification.countDocuments.mockResolvedValue(2);

    await expect(notificationService.countUnread(USER_ID)).resolves.toBe(2);
  });
});

describe('getMyNotifications', () => {
  it('chỉ trả thông báo của chính mình', async () => {
    Notification.find.mockReturnValue(mockQuery([]));
    Notification.countDocuments.mockResolvedValue(0);

    await notificationService.getMyNotifications(USER_ID, {});

    expect(Notification.find).toHaveBeenCalledWith({ recipient: USER_ID });
  });

  it('lọc chưa đọc bằng ?unread=true', async () => {
    Notification.find.mockReturnValue(mockQuery([]));

    await notificationService.getMyNotifications(USER_ID, { unread: 'true' });

    expect(Notification.find).toHaveBeenCalledWith({ recipient: USER_ID, readAt: null });
  });

  it('lọc theo loại', async () => {
    Notification.find.mockReturnValue(mockQuery([]));

    await notificationService.getMyNotifications(USER_ID, { type: NotificationType.INVOICE_ISSUED });

    expect(Notification.find).toHaveBeenCalledWith({
      recipient: USER_ID,
      type: NotificationType.INVOICE_ISSUED,
    });
  });
});

describe('markAsRead', () => {
  it('đánh dấu đã đọc và xoá cache', async () => {
    const save = jest.fn().mockResolvedValue({});
    Notification.findOne.mockResolvedValue({ _id: NOTIFICATION_ID, readAt: null, save });
    await cache.set(CacheKeys.unreadNotifications(USER_ID), 5);

    const result = await notificationService.markAsRead(USER_ID, NOTIFICATION_ID);

    expect(save).toHaveBeenCalled();
    expect(result.readAt).toBeInstanceOf(Date);
    expect(await cache.get(CacheKeys.unreadNotifications(USER_ID))).toBeNull();
  });

  it('gọi lại lần nữa không ghi thêm gì — client hay gọi lặp', async () => {
    const readAt = new Date('2026-08-01T00:00:00.000Z');
    const save = jest.fn();
    Notification.findOne.mockResolvedValue({ _id: NOTIFICATION_ID, readAt, save });

    const result = await notificationService.markAsRead(USER_ID, NOTIFICATION_ID);

    expect(save).not.toHaveBeenCalled();
    expect(result.readAt).toBe(readAt);
  });

  it('thông báo của người khác trả 404, không trả 403 — không lộ là nó có tồn tại', async () => {
    Notification.findOne.mockResolvedValue(null);

    await expect(notificationService.markAsRead(USER_ID, NOTIFICATION_ID))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(Notification.findOne).toHaveBeenCalledWith({ _id: NOTIFICATION_ID, recipient: USER_ID });
  });
});

describe('markAllAsRead', () => {
  it('chỉ đụng tới thông báo chưa đọc của chính mình', async () => {
    Notification.updateMany.mockResolvedValue({ modifiedCount: 6 });

    const result = await notificationService.markAllAsRead(USER_ID);

    expect(result).toEqual({ modified: 6 });
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { recipient: USER_ID, readAt: null },
      expect.objectContaining({ readAt: expect.any(Date) })
    );
  });
});
