const { Router } = require('express');
const controller = require('../controllers/admin.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const Role = require('../constants/roles');
const {
  revenueQuerySchema, ownersQuerySchema, adminFieldsQuerySchema,
  adminUsersQuerySchema, updateUserSchema, auditLogQuerySchema,
} = require('../validations/admin.validation');
const { invoiceQuerySchema, voidInvoiceSchema } = require('../validations/billing.validation');

const router = Router();

// Toàn bộ khu vực này chỉ dành cho quản trị viên nền tảng
router.use(authenticate, authorize(Role.ADMIN));

// ── Thống kê ──────────────────────────────────────────────────────────────────
router.get('/overview', controller.getOverview);
router.get('/revenue', validate(revenueQuerySchema, 'query'), controller.getRevenueSeries);

// ── Chủ sân (mức sử dụng + tiền thuê đã trả) ──────────────────────────────────
router.get('/owners', validate(ownersQuerySchema, 'query'), controller.getOwners);
router.get('/owners/:id', controller.getOwnerDetail);

// ── Người dùng ────────────────────────────────────────────────────────────────
router.get('/users', validate(adminUsersQuerySchema, 'query'), controller.getUsers);
router.patch('/users/:id', validate(updateUserSchema), controller.updateUser);

// ── Sân (hàng chờ duyệt) ──────────────────────────────────────────────────────
router.get('/fields', validate(adminFieldsQuerySchema, 'query'), controller.getFields);

// ── Hoá đơn thuê bao ──────────────────────────────────────────────────────────
router.get('/invoices', validate(invoiceQuerySchema, 'query'), controller.getInvoices);
router.patch('/invoices/:id/confirm', controller.confirmInvoice);
router.patch('/invoices/:id/void', validate(voidInvoiceSchema), controller.voidInvoice);

// ── Nhật ký hành động admin ───────────────────────────────────────────────────
router.get('/audit-log', validate(auditLogQuerySchema, 'query'), controller.getAuditLog);

module.exports = router;
