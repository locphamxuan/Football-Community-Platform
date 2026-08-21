const mongoose = require('mongoose');
const { AdminAction, AdminTargetType } = require('../constants/adminAudit');

const adminAuditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: Object.values(AdminAction), required: true },
    targetType: { type: String, enum: Object.values(AdminTargetType), required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    /** Ảnh chụp phần thay đổi — vd. { from: ['user'], to: ['user','field_owner'] }. */
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Nhật ký luôn đọc theo thời gian, thỉnh thoảng lọc theo admin để tra một tài khoản cụ thể.
adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ admin: 1, createdAt: -1 });

const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema);
module.exports = AdminAuditLog;
