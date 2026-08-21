const AdminAuditLog = require('../models/AdminAuditLog');
const { getPagination } = require('../utils/pagination');
const logger = require('../utils/logger');

/**
 * Ghi một dòng nhật ký hành động admin. Cố ý không throw: một admin đổi role
 * hay huỷ hoá đơn thành công không được phép thất bại chỉ vì việc ghi log
 * gặp trục trặc — lỗi ghi log chỉ vào logger để không mất dấu hoàn toàn.
 */
const record = async (adminId, action, targetType, targetId, details = {}) => {
  try {
    await AdminAuditLog.create({ admin: adminId, action, targetType, targetId, details });
  } catch (err) {
    logger.error('Failed to write admin audit log', { adminId, action, targetType, targetId, error: err.message });
  }
};

/** Nhật ký hành động admin, mới nhất trước — lọc được theo admin hoặc loại hành động. */
const getAuditLog = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.adminId) filter.admin = query.adminId;
  if (query.action) filter.action = query.action;

  const [logs, total] = await Promise.all([
    AdminAuditLog.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('admin', 'username fullName email')
      .lean(),
    AdminAuditLog.countDocuments(filter),
  ]);

  return { logs, total, page, limit };
};

module.exports = { record, getAuditLog };
