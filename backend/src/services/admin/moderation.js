const User = require('../../models/User');
const Field = require('../../models/Field');
const billingService = require('../billing');
const adminAuditLogService = require('../adminAuditLog.service');
const { getPagination } = require('../../utils/pagination');
const { AdminAction, AdminTargetType } = require('../../constants/adminAudit');
const Role = require('../../constants/roles');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');

// ─── field moderation ─────────────────────────────────────────────────────────
const getFieldsForModeration = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.verified === 'true') filter.isVerified = true;
  if (query.verified === 'false') filter.isVerified = false;
  if (query.search) filter.$text = { $search: query.search };

  const [fields, total] = await Promise.all([
    Field.find(filter)
      .populate('owner', 'username fullName email avatar phone')
      .skip(skip).limit(limit).sort('-createdAt'),
    Field.countDocuments(filter),
  ]);
  return { fields, total, page, limit };
};

// ─── user moderation ──────────────────────────────────────────────────────────
/** Cập nhật quyền của user. Admin không được tự hạ quyền chính mình để tránh khoá cửa hệ thống. */
const updateUserRoles = async (userId, roles, actingAdminId) => {
  if (userId === actingAdminId && !roles.includes(Role.ADMIN)) {
    throw new AppError('You cannot remove your own admin role', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  // Gỡ quyền chủ sân khi vẫn còn sân đang hoạt động sẽ để lại sân không ai quản lý
  if (user.roles.includes(Role.FIELD_OWNER) && !roles.includes(Role.FIELD_OWNER)) {
    const owned = await Field.countDocuments({ owner: userId });
    if (owned > 0) {
      throw new AppError(
        `This user still owns ${owned} field(s). Transfer or delete them before removing the field owner role.`,
        HttpStatus.CONFLICT,
        ErrorCode.CONFLICT
      );
    }
  }

  const previousRoles = user.roles;
  user.roles = [...new Set(roles)];
  await user.save();

  if (user.roles.includes(Role.FIELD_OWNER)) {
    // Chủ sân mới cần có thuê bao để tính hạn mức và hoá đơn
    await billingService.ensureSubscription(user._id);
  }

  await adminAuditLogService.record(
    actingAdminId, AdminAction.USER_ROLES_UPDATED, AdminTargetType.USER, userId,
    { from: previousRoles, to: user.roles }
  );

  return user;
};

/** Cấm user kèm ràng buộc: không tự cấm chính mình. */
const updateUserStatus = async (userId, status, actingAdminId) => {
  if (userId === actingAdminId && status !== 'active') {
    throw new AppError('You cannot deactivate your own account', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);
  }
  const previous = await User.findById(userId).select('status');
  if (!previous) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  const user = await User.findByIdAndUpdate(userId, { status }, { new: true, runValidators: true });

  await adminAuditLogService.record(
    actingAdminId, AdminAction.USER_STATUS_UPDATED, AdminTargetType.USER, userId,
    { from: previous.status, to: status }
  );

  return user;
};

module.exports = { getFieldsForModeration, updateUserRoles, updateUserStatus };
