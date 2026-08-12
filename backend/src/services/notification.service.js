const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendExpoPush } = require('./push.service');
const { getPagination } = require('../utils/pagination');
const { cache, CacheKeys, CacheTTL } = require('../config/redis');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

const invalidateUnread = (userId) => cache.del(CacheKeys.unreadNotifications(userId.toString()));

/**
 * Bắn một thông báo cho một người.
 *
 * **Không bao giờ ném lỗi.** Thông báo là hệ quả của một hành động đã thành công
 * (lịch đặt đã xác nhận, hoá đơn đã phát hành); để nó làm hỏng hành động gốc là
 * đánh đổi ngược — người dùng mất việc chính chỉ vì cái chuông không kêu.
 *
 * @param {*} recipientId  người nhận; bỏ qua nếu rỗng (đội chưa có quản lý chẳng hạn)
 * @param {{type: string, title: string, body?: string, link?: string}} payload
 * @param {*} [actorId]    người vừa gây ra sự kiện — không tự bắn thông báo cho chính họ
 */
const notify = async (recipientId, payload, actorId = null) => {
  if (!recipientId) return null;
  if (actorId && recipientId.toString() === actorId.toString()) return null;

  try {
    const notification = await Notification.create({
      recipient: recipientId,
      type: payload.type,
      title: payload.title,
      body: payload.body || '',
      link: payload.link || '',
    });
    await invalidateUnread(recipientId);

    // Đẩy sau khi đã ghi: hộp thư in-app là nguồn sự thật, đẩy chỉ là lớp báo sớm.
    // Không có thiết bị nào đăng ký thì đây chỉ là một truy vấn rẻ rồi thôi.
    const recipient = await User.findById(recipientId).select('expoPushTokens notifications');
    if (recipient) {
      await sendExpoPush(recipient, {
        title: notification.title,
        body: notification.body,
        link: notification.link,
      });
    }

    return notification;
  } catch (err) {
    logger.error('Notification create failed:', err.message);
    return null;
  }
};

// ─── getMyNotifications ────────────────────────────────────────────────────────
const getMyNotifications = async (userId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { recipient: userId };
  if (query.unread === 'true') filter.readAt = null;
  if (query.type) filter.type = query.type;

  const [notifications, total] = await Promise.all([
    Notification.find(filter).skip(skip).limit(limit).sort('-createdAt'),
    Notification.countDocuments(filter),
  ]);
  return { notifications, total, page, limit };
};

// ─── countUnread ───────────────────────────────────────────────────────────────
/** Số thông báo chưa đọc, đọc từ Redis nếu có — chuông hỏi con số này trên mọi trang. */
const countUnread = async (userId) => {
  const key = CacheKeys.unreadNotifications(userId.toString());
  const cached = await cache.get(key);
  if (cached !== null) {
    const parsed = Number(cached);
    if (Number.isInteger(parsed)) return parsed;
  }

  const count = await Notification.countDocuments({ recipient: userId, readAt: null });
  await cache.set(key, count, CacheTTL.UNREAD_NOTIFICATIONS);
  return count;
};

// ─── markAsRead ────────────────────────────────────────────────────────────────
/** Đánh dấu đã đọc. Gọi lại lần nữa không đổi gì — client hay gọi lặp khi mở danh sách. */
const markAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOne({ _id: notificationId, recipient: userId });
  if (!notification) throw new AppError('Notification not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
    await invalidateUnread(userId);
  }
  return notification;
};

// ─── markAllAsRead ─────────────────────────────────────────────────────────────
const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, readAt: null },
    { readAt: new Date() }
  );
  await invalidateUnread(userId);
  return { modified: result.modifiedCount ?? 0 };
};

module.exports = { notify, getMyNotifications, countUnread, markAsRead, markAllAsRead };
