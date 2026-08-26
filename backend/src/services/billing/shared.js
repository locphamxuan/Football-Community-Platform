const { randomBytes } = require('crypto');
const mongoose = require('mongoose');
const Subscription = require('../../models/Subscription');
const Invoice = require('../../models/Invoice');
const Field = require('../../models/Field');
const Booking = require('../../models/Booking');
const { notify } = require('../notification.service');
const { NotificationType } = require('../../constants/notifications');
const {
  PlanCode, getPlan, SubscriptionStatus, InvoiceStatus,
} = require('../../constants/plans');

const PAYMENT_TERM_DAYS = 7;
const MAX_CATCH_UP_PERIODS = 12; // chặn phát hành hàng loạt nếu thuê bao bị bỏ quên nhiều tháng

const addMonths = (date, months) => {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  const day = d.getDate();
  d.setMonth(targetMonth, 1);
  // Giữ ngày trong tháng, lùi về ngày cuối tháng nếu tháng đích ngắn hơn (31/01 → 28/02)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
};

const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

const generateInvoiceCode = () => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `INV-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`;
};

const monthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
};

const issueInvoice = async (subscription, { periodStart, periodEnd, description }) => {
  const plan = getPlan(subscription.plan);
  const dueDate = addDays(periodStart, PAYMENT_TERM_DAYS);
  const invoice = await Invoice.create({
    code: generateInvoiceCode(),
    owner: subscription.owner,
    subscription: subscription._id,
    plan: plan.code,
    description: description || `Thuê bao gói ${plan.name}`,
    amount: plan.monthlyPrice,
    periodStart,
    periodEnd,
    dueDate,
    status: InvoiceStatus.PENDING,
  });

  // Hoá đơn được phát hành âm thầm lúc gia hạn "lười", không do chủ sân bấm nút nào —
  // không báo thì họ chỉ biết khi thuê bao đã past_due và sân bị chặn.
  await notify(subscription.owner, {
    type: NotificationType.INVOICE_ISSUED,
    title: `Hoá đơn mới ${invoice.code}`,
    body: `${invoice.description} · ${invoice.amount.toLocaleString('vi-VN')}đ · hạn ${dueDate.toLocaleDateString('vi-VN')}`,
    link: '/owner/billing',
  });

  return invoice;
};

/**
 * Lấy thuê bao của chủ sân, tạo mới gói miễn phí nếu chưa có, và gia hạn "lười" khi chu kỳ đã hết.
 * Gia hạn khi đọc thay vì bằng cron: không cần job nền, và không bao giờ phát hành trùng hoá đơn.
 */
const ensureSubscription = async (ownerId) => {
  const now = new Date();
  let subscription = await Subscription.findOne({ owner: ownerId });

  if (!subscription) {
    subscription = await Subscription.create({
      owner: ownerId,
      plan: PlanCode.FREE,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: addMonths(now, 1),
    });
    return subscription;
  }

  let guard = 0;
  while (subscription.currentPeriodEnd <= now && guard < MAX_CATCH_UP_PERIODS) {
    guard += 1;
    const periodStart = subscription.currentPeriodEnd;
    const periodEnd = addMonths(periodStart, 1);
    const plan = getPlan(subscription.plan);

    if (plan.monthlyPrice === 0) {
      subscription.currentPeriodStart = periodStart;
      subscription.currentPeriodEnd = periodEnd;
    } else if (!subscription.autoRenew || subscription.status === SubscriptionStatus.CANCELLED) {
      // Hết hạn mà không gia hạn → rơi về gói miễn phí, không phát hành hoá đơn
      subscription.plan = PlanCode.FREE;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.currentPeriodStart = periodStart;
      subscription.currentPeriodEnd = periodEnd;
    } else {
      subscription.currentPeriodStart = periodStart;
      subscription.currentPeriodEnd = periodEnd;
      subscription.status = SubscriptionStatus.PAST_DUE;
      // eslint-disable-next-line no-await-in-loop
      await issueInvoice(subscription, { periodStart, periodEnd, description: `Gia hạn gói ${plan.name}` });
    }
  }

  if (subscription.isModified()) await subscription.save();
  return subscription;
};

/** Số liệu sử dụng của chủ sân trong tháng hiện tại — cơ sở để đối chiếu hạn mức gói. */
const getOwnerUsage = async (ownerId) => {
  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const { start, end } = monthRange();

  const fields = await Field.find({ owner: ownerObjectId }).select('_id status subFields').lean();
  const fieldIds = fields.map((f) => f._id);

  const [bookingsThisMonth, grossAgg] = await Promise.all([
    fieldIds.length
      ? Booking.countDocuments({ field: { $in: fieldIds }, createdAt: { $gte: start, $lt: end } })
      : 0,
    fieldIds.length
      ? Booking.aggregate([
        { $match: { field: { $in: fieldIds }, status: 'completed', date: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ])
      : [],
  ]);

  return {
    totalFields: fields.length,
    activeFields: fields.filter((f) => f.status === 'active').length,
    totalSubFields: fields.reduce((sum, f) => sum + (f.subFields?.length ?? 0), 0),
    bookingsThisMonth,
    grossRevenueThisMonth: grossAgg[0]?.total ?? 0,
  };
};

/**
 * Đánh dấu hoá đơn đã thanh toán và mở lại thuê bao nếu hết công nợ — dùng chung cho đường
 * thủ công (admin xác nhận) và đường cổng thanh toán (IPN). Người gọi tự set các field riêng
 * (`confirmedBy` hoặc `paymentProvider`/`gatewayTransactionId`) trước khi gọi hàm này.
 */
const settleInvoice = async (invoice) => {
  invoice.status = InvoiceStatus.PAID;
  invoice.paidAt = new Date();
  await invoice.save();

  const subscription = await Subscription.findById(invoice.subscription);
  if (subscription) {
    subscription.totalPaid += invoice.amount;
    // Chỉ mở lại thuê bao khi không còn hoá đơn nào chưa thanh toán
    const stillOwing = await Invoice.countDocuments({
      owner: invoice.owner,
      status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.AWAITING_CONFIRMATION] },
    });
    if (stillOwing === 0) subscription.status = SubscriptionStatus.ACTIVE;
    await subscription.save();
  }
};

module.exports = {
  addMonths, monthRange, issueInvoice, ensureSubscription, getOwnerUsage, settleInvoice,
};
