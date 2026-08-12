const notificationService = require('../services/notification.service');
const { sendSuccess, paginationMeta } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');

const getMyNotifications = catchAsync(async (req, res) => {
  const [{ notifications, total, page, limit }, unreadCount] = await Promise.all([
    notificationService.getMyNotifications(req.user.id, req.query),
    notificationService.countUnread(req.user.id),
  ]);
  // Chuông cần cả danh sách lẫn số chưa đọc — trả kèm để client khỏi gọi thêm một vòng
  sendSuccess(res, { notifications, unreadCount }, 'Notifications retrieved', HttpStatus.OK, {
    pagination: paginationMeta(total, page, limit),
  });
});

const getUnreadCount = catchAsync(async (req, res) => {
  const unreadCount = await notificationService.countUnread(req.user.id);
  sendSuccess(res, { unreadCount });
});

const markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(req.user.id, req.params.id);
  sendSuccess(res, { notification }, 'Notification marked as read');
});

const markAllAsRead = catchAsync(async (req, res) => {
  const { modified } = await notificationService.markAllAsRead(req.user.id);
  sendSuccess(res, { modified }, 'All notifications marked as read');
});

module.exports = { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead };
