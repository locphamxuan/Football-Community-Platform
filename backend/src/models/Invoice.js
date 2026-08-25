const mongoose = require('mongoose');
const { PLAN_CODES, InvoiceStatus } = require('../constants/plans');

/**
 * Hoá đơn tiền thuê nền tảng do chủ sân trả.
 * Vòng đời: pending → awaiting_confirmation (chủ sân báo đã chuyển khoản) → paid (admin đối soát).
 */
const invoiceSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
    plan: { type: String, enum: PLAN_CODES, required: true },
    description: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(InvoiceStatus),
      default: InvoiceStatus.PENDING,
    },
    dueDate: { type: Date, required: true },
    /** Mã giao dịch chủ sân khai báo khi chuyển khoản. */
    paymentReference: { type: String, default: '' },
    reportedAt: { type: Date },
    paidAt: { type: Date },
    /** Vắng mặt khi thanh toán qua cổng — không phải admin nào xác nhận cả. */
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String, default: '' },
    paymentProvider: { type: String, enum: ['manual', 'vnpay', 'momo'], default: 'manual' },
    /** Mã giao dịch phía cổng thanh toán — chỉ có khi `paymentProvider !== 'manual'`. */
    gatewayTransactionId: { type: String },
  },
  { timestamps: true }
);

invoiceSchema.index({ owner: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ paidAt: -1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);
module.exports = Invoice;
