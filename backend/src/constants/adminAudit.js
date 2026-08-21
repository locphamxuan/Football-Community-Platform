/**
 * Hành động quản trị đáng ghi vết — mọi thao tác đổi quyền, tiền, hoặc trạng thái
 * công khai của người khác mà một admin bị lộ tài khoản (hoặc lạm quyền) có thể
 * dùng để gây hại. Xem chỉ để đọc (getUsers, getOverview...) không cần ghi.
 */
const AdminAction = {
  USER_ROLES_UPDATED: 'user.roles_updated',
  USER_STATUS_UPDATED: 'user.status_updated',
  INVOICE_CONFIRMED: 'invoice.confirmed',
  INVOICE_VOIDED: 'invoice.voided',
  FIELD_VERIFIED: 'field.verified',
};

const AdminTargetType = {
  USER: 'User',
  INVOICE: 'Invoice',
  FIELD: 'Field',
};

module.exports = { AdminAction, AdminTargetType };
