const mongoose = require('mongoose');
const { PLAN_CODES, PlanCode, SubscriptionStatus } = require('../constants/plans');

/**
 * Thuê bao của một chủ sân với nền tảng. Mỗi chủ sân có đúng một bản ghi.
 * Chu kỳ được gia hạn "lười": kiểm tra khi đọc thay vì chạy cron, tránh phát hành trùng hoá đơn.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan: { type: String, enum: PLAN_CODES, default: PlanCode.FREE },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.ACTIVE,
    },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    autoRenew: { type: Boolean, default: true },
    /** Tổng tiền chủ sân đã thực trả cho nền tảng (chỉ cộng khi admin xác nhận hoá đơn). */
    totalPaid: { type: Number, default: 0, min: 0 },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ plan: 1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);
module.exports = Subscription;
