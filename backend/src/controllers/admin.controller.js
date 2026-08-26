const adminService = require('../services/admin.service');
const billingService = require('../services/billing');
const userService = require('../services/user.service');
const adminAuditLogService = require('../services/adminAuditLog.service');
const { sendSuccess, paginationMeta } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');

const getOverview = catchAsync(async (_req, res) => {
  const overview = await adminService.getPlatformOverview();
  sendSuccess(res, { overview });
});

const getRevenueSeries = catchAsync(async (req, res) => {
  const series = await adminService.getRevenueSeries(req.query.months);
  sendSuccess(res, { series });
});

const getOwners = catchAsync(async (req, res) => {
  const { owners, total, page, limit } = await adminService.getOwners(req.query);
  sendSuccess(res, { owners }, 'Owners retrieved', HttpStatus.OK, {
    pagination: paginationMeta(total, page, limit),
  });
});

const getOwnerDetail = catchAsync(async (req, res) => {
  const detail = await adminService.getOwnerDetail(req.params.id);
  sendSuccess(res, detail);
});

const getUsers = catchAsync(async (req, res) => {
  const { users, total, page, limit } = await userService.getUsers(req.query);
  sendSuccess(res, { users }, 'Users retrieved', HttpStatus.OK, {
    pagination: paginationMeta(total, page, limit),
  });
});

const updateUser = catchAsync(async (req, res) => {
  let user;
  if (req.body.roles) {
    user = await adminService.updateUserRoles(req.params.id, req.body.roles, req.user.id);
  }
  if (req.body.status) {
    user = await adminService.updateUserStatus(req.params.id, req.body.status, req.user.id);
  }
  sendSuccess(res, { user }, 'User updated');
});

const getFields = catchAsync(async (req, res) => {
  const { fields, total, page, limit } = await adminService.getFieldsForModeration(req.query);
  sendSuccess(res, { fields }, 'Fields retrieved', HttpStatus.OK, {
    pagination: paginationMeta(total, page, limit),
  });
});

const getInvoices = catchAsync(async (req, res) => {
  const { invoices, total, page, limit } = await billingService.getInvoices(req.query);
  sendSuccess(res, { invoices }, 'Invoices retrieved', HttpStatus.OK, {
    pagination: paginationMeta(total, page, limit),
  });
});

const confirmInvoice = catchAsync(async (req, res) => {
  const invoice = await billingService.confirmInvoicePayment(req.params.id, req.user.id);
  sendSuccess(res, { invoice }, 'Invoice marked as paid');
});

const voidInvoice = catchAsync(async (req, res) => {
  const invoice = await billingService.voidInvoice(req.params.id, req.body.reason, req.user.id);
  sendSuccess(res, { invoice }, 'Invoice voided');
});

const getAuditLog = catchAsync(async (req, res) => {
  const { logs, total, page, limit } = await adminAuditLogService.getAuditLog(req.query);
  sendSuccess(res, { logs }, 'Audit log retrieved', HttpStatus.OK, {
    pagination: paginationMeta(total, page, limit),
  });
});

module.exports = {
  getOverview, getRevenueSeries, getOwners, getOwnerDetail,
  getUsers, updateUser, getFields,
  getInvoices, confirmInvoice, voidInvoice, getAuditLog,
};
