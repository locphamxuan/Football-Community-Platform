const mongoose = require('mongoose');
const Invoice = require('../../models/Invoice');
const { getPagination } = require('../../utils/pagination');
const adminAuditLogService = require('../adminAuditLog.service');
const { InvoiceStatus } = require('../../constants/plans');
const { AdminAction, AdminTargetType } = require('../../constants/adminAudit');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');
const { settleInvoice } = require('./shared');

// ─── invoices (admin) ─────────────────────────────────────────────────────────
const getInvoices = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.ownerId) filter.owner = new mongoose.Types.ObjectId(query.ownerId);

  const [invoices, total] = await Promise.all([
    Invoice.find(filter).populate('owner', 'username fullName email avatar').skip(skip).limit(limit).sort('-createdAt'),
    Invoice.countDocuments(filter),
  ]);
  return { invoices, total, page, limit };
};

/** Admin đối soát: ghi nhận tiền, kích hoạt lại thuê bao. */
const confirmInvoicePayment = async (invoiceId, adminId) => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError('Invoice not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (![InvoiceStatus.PENDING, InvoiceStatus.AWAITING_CONFIRMATION].includes(invoice.status)) {
    throw new AppError('Invoice is already settled', HttpStatus.BAD_REQUEST, ErrorCode.INVOICE_NOT_PAYABLE);
  }

  invoice.confirmedBy = new mongoose.Types.ObjectId(adminId);
  await settleInvoice(invoice);

  await adminAuditLogService.record(
    adminId, AdminAction.INVOICE_CONFIRMED, AdminTargetType.INVOICE, invoiceId,
    { amount: invoice.amount, owner: invoice.owner }
  );

  return invoice;
};

const voidInvoice = async (invoiceId, reason, adminId) => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError('Invoice not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (invoice.status === InvoiceStatus.PAID) {
    throw new AppError('Paid invoices cannot be voided', HttpStatus.BAD_REQUEST, ErrorCode.INVOICE_NOT_PAYABLE);
  }

  invoice.status = InvoiceStatus.VOID;
  invoice.voidReason = reason || 'Huỷ bởi quản trị viên';
  await invoice.save();

  await adminAuditLogService.record(
    adminId, AdminAction.INVOICE_VOIDED, AdminTargetType.INVOICE, invoiceId,
    { amount: invoice.amount, owner: invoice.owner, reason: invoice.voidReason }
  );

  return invoice;
};

module.exports = { getInvoices, confirmInvoicePayment, voidInvoice };
