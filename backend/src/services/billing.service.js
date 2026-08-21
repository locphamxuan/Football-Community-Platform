const { randomBytes } = require('crypto');
const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Field = require('../models/Field');
const Booking = require('../models/Booking');
const { getPagination } = require('../utils/pagination');
const { notify } = require('./notification.service');
const adminAuditLogService = require('./adminAuditLog.service');
const { NotificationType } = require('../constants/notifications');
const { PLANS, PlanCode, getPlan, SubscriptionStatus, InvoiceStatus } = require('../constants/plans');
const { AdminAction, AdminTargetType } = require('../constants/adminAudit');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

const PAYMENT_TERM_DAYS = 7;
const MAX_CATCH_UP_PERIODS = 12; // chặn phát hành hàng loạt nếu thuê bao bị bỏ quên nhiều tháng

// ─── helpers ──────────────────────────────────────────────────────────────────
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

// ─── getMySubscription ────────────────────────────────────────────────────────
const getMySubscription = async (ownerId) => {
  const subscription = await ensureSubscription(ownerId);
  const [usage, outstanding] = await Promise.all([
    getOwnerUsage(ownerId),
    Invoice.find({
      owner: ownerId,
      status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.AWAITING_CONFIRMATION] },
    }).sort('dueDate'),
  ]);

  return {
    subscription,
    plan: getPlan(subscription.plan),
    plans: Object.values(PLANS),
    usage,
    outstandingInvoices: outstanding,
    outstandingAmount: outstanding.reduce((sum, i) => sum + i.amount, 0),
  };
};

// ─── changePlan ───────────────────────────────────────────────────────────────
const changePlan = async (ownerId, planCode) => {
  const subscription = await ensureSubscription(ownerId);
  if (subscription.plan === planCode) {
    throw new AppError('You are already on this plan', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);
  }

  const newPlan = getPlan(planCode);
  const usage = await getOwnerUsage(ownerId);
  if (usage.totalFields > newPlan.maxFields) {
    throw new AppError(
      `Plan "${newPlan.name}" allows ${newPlan.maxFields} field(s) but you currently have ${usage.totalFields}. Remove some fields first.`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.PLAN_LIMIT_REACHED
    );
  }

  // Hoá đơn chưa thanh toán của gói cũ không còn ý nghĩa khi đổi gói
  await Invoice.updateMany(
    { owner: ownerId, status: InvoiceStatus.PENDING },
    { status: InvoiceStatus.VOID, voidReason: 'Huỷ do chủ sân đổi gói thuê bao' }
  );

  const now = new Date();
  subscription.plan = newPlan.code;
  subscription.currentPeriodStart = now;
  subscription.currentPeriodEnd = addMonths(now, 1);
  subscription.cancelledAt = undefined;
  subscription.autoRenew = true;

  let invoice = null;
  if (newPlan.monthlyPrice > 0) {
    // Gói trả phí chỉ chuyển sang active sau khi admin xác nhận đã nhận tiền
    subscription.status = SubscriptionStatus.PAST_DUE;
    await subscription.save();
    invoice = await issueInvoice(subscription, {
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      description: `Đăng ký gói ${newPlan.name}`,
    });
  } else {
    subscription.status = SubscriptionStatus.ACTIVE;
    await subscription.save();
  }

  return { subscription, plan: newPlan, invoice };
};

// ─── cancelAutoRenew ──────────────────────────────────────────────────────────
const setAutoRenew = async (ownerId, autoRenew) => {
  const subscription = await ensureSubscription(ownerId);
  subscription.autoRenew = autoRenew;
  subscription.cancelledAt = autoRenew ? undefined : new Date();
  await subscription.save();
  return subscription;
};

// ─── invoices (owner) ─────────────────────────────────────────────────────────
const getMyInvoices = async (ownerId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { owner: new mongoose.Types.ObjectId(ownerId) };
  if (query.status) filter.status = query.status;

  const [invoices, total] = await Promise.all([
    Invoice.find(filter).skip(skip).limit(limit).sort('-createdAt'),
    Invoice.countDocuments(filter),
  ]);
  return { invoices, total, page, limit };
};

/** Chủ sân khai báo đã chuyển khoản; tiền chỉ được ghi nhận khi admin đối soát. */
const reportPayment = async (ownerId, invoiceId, paymentReference) => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError('Invoice not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (invoice.owner.toString() !== ownerId) {
    throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }
  if (invoice.status !== InvoiceStatus.PENDING) {
    throw new AppError('Only pending invoices can be reported as paid', HttpStatus.BAD_REQUEST, ErrorCode.INVOICE_NOT_PAYABLE);
  }

  invoice.status = InvoiceStatus.AWAITING_CONFIRMATION;
  invoice.paymentReference = paymentReference;
  invoice.reportedAt = new Date();
  await invoice.save();
  return invoice;
};

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

  invoice.status = InvoiceStatus.PAID;
  invoice.paidAt = new Date();
  invoice.confirmedBy = new mongoose.Types.ObjectId(adminId);
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

// ─── quota guard ──────────────────────────────────────────────────────────────
/** Chặn tạo sân vượt hạn mức gói, hoặc khi còn nợ hoá đơn. */
const assertCanCreateField = async (ownerId) => {
  const subscription = await ensureSubscription(ownerId);
  const plan = getPlan(subscription.plan);

  if (subscription.status === SubscriptionStatus.PAST_DUE) {
    throw new AppError(
      'Your subscription has an unpaid invoice. Settle it before adding a new field.',
      HttpStatus.PAYMENT_REQUIRED,
      ErrorCode.SUBSCRIPTION_PAST_DUE
    );
  }

  const fieldCount = await Field.countDocuments({ owner: ownerId });
  if (fieldCount >= plan.maxFields) {
    throw new AppError(
      `Plan "${plan.name}" is limited to ${plan.maxFields} field(s). Upgrade your plan to add more.`,
      HttpStatus.PAYMENT_REQUIRED,
      ErrorCode.PLAN_LIMIT_REACHED
    );
  }
  return { subscription, plan };
};

/** Chặn thêm sân con vượt hạn mức gói. */
const assertCanAddSubField = async (ownerId, currentSubFieldCount) => {
  const subscription = await ensureSubscription(ownerId);
  const plan = getPlan(subscription.plan);
  if (currentSubFieldCount >= plan.maxSubFieldsPerField) {
    throw new AppError(
      `Plan "${plan.name}" is limited to ${plan.maxSubFieldsPerField} sub-field(s) per field. Upgrade your plan to add more.`,
      HttpStatus.PAYMENT_REQUIRED,
      ErrorCode.PLAN_LIMIT_REACHED
    );
  }
  return { subscription, plan };
};

module.exports = {
  ensureSubscription,
  getOwnerUsage,
  getMySubscription,
  changePlan,
  setAutoRenew,
  getMyInvoices,
  reportPayment,
  getInvoices,
  confirmInvoicePayment,
  voidInvoice,
  assertCanCreateField,
  assertCanAddSubField,
  monthRange,
  addMonths,
};
