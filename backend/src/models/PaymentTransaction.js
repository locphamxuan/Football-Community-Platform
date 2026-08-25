const mongoose = require('mongoose');

/**
 * Một lượt gọi cổng thanh toán cho một hoá đơn — không phải hoá đơn (nhiều lượt có thể trỏ
 * cùng một `invoice` nếu chủ sân bấm thanh toán lại sau khi lượt trước thất bại/bỏ dở).
 *
 * `providerTxnRef` unique theo từng `provider`: IPN gọi lại với cùng cặp này (VNPay retry khi
 * không nhận được response) sẽ vỡ unique index — đó chính là cơ chế idempotent, không cần
 * kiểm tra "đã xử lý chưa" bằng tay trước khi ghi.
 */
const paymentTransactionSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    provider: { type: String, enum: ['vnpay', 'momo'], required: true },
    providerTxnRef: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    /** Toàn bộ query/body cổng trả về — giữ lại để tra soát khi có tranh chấp. */
    rawResponse: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentTransactionSchema.index({ provider: 1, providerTxnRef: 1 }, { unique: true });
paymentTransactionSchema.index({ invoice: 1, createdAt: -1 });

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
module.exports = PaymentTransaction;
