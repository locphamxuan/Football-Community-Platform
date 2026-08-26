const Field = require('../../models/Field');
const adminAuditLogService = require('../adminAuditLog.service');
const { cache, CacheKeys } = require('../../config/redis');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');
const { AdminAction, AdminTargetType } = require('../../constants/adminAudit');

/**
 * Admin duyệt hoặc từ chối một sân.
 * Từ chối đưa sân về 'inactive' (không nhận đặt) thay vì xoá, để chủ sân sửa rồi xin duyệt lại.
 */
const verifyField = async (fieldId, { approve = true, note = '' } = {}, adminId) => {
  const update = approve
    ? { isVerified: true, status: 'active', moderationNote: note, moderatedAt: new Date() }
    : { isVerified: false, status: 'inactive', moderationNote: note, moderatedAt: new Date() };

  const field = await Field.findByIdAndUpdate(fieldId, update, { new: true })
    .populate('owner', 'username fullName email');
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  await cache.del(CacheKeys.field(fieldId));

  await adminAuditLogService.record(
    adminId, AdminAction.FIELD_VERIFIED, AdminTargetType.FIELD, fieldId, { approve, note }
  );

  return field;
};

module.exports = { verifyField };
