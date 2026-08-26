const { randomBytes } = require('crypto');
const mongoose = require('mongoose');
const Invoice = require('../../models/Invoice');
const Field = require('../../models/Field');
const PaymentTransaction = require('../../models/PaymentTransaction');
const { getPagination } = require('../../utils/pagination');
const { getProvider } = require('../payments');
const {
  PLANS, getPlan, SubscriptionStatus, InvoiceStatus,
} = require('../../constants/plans');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');
const {
  addMonths, issueInvoice, ensureSubscription, getOwnerUsage,
} = require('./shared');

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

// ─── thanh toán online ──────────────────────────────────────────────────────
/** Chủ sân bấm "Thanh toán online" — tạo link thanh toán và một lượt giao dịch đang chờ. */
const createCheckoutSession = async (ownerId, invoiceId, providerName, ipAddr) => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError('Invoice not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (invoice.owner.toString() !== ownerId) {
    throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }
  if (![InvoiceStatus.PENDING, InvoiceStatus.AWAITING_CONFIRMATION].includes(invoice.status)) {
    throw new AppError('Only pending invoices can be paid', HttpStatus.BAD_REQUEST, ErrorCode.INVOICE_NOT_PAYABLE);
  }

  const gateway = getProvider(providerName);
  const txnRef = `${invoice.code}-${randomBytes(4).toString('hex').toUpperCase()}`;

  await PaymentTransaction.create({
    invoice: invoice._id,
    provider: gateway.name,
    providerTxnRef: txnRef,
    amount: invoice.amount,
  });

  const paymentUrl = gateway.createPaymentUrl(
    { txnRef, amount: invoice.amount, orderInfo: `Thanh toan hoa don ${invoice.code}` },
    { ipAddr }
  );

  return { paymentUrl };
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
  getMySubscription,
  changePlan,
  setAutoRenew,
  getMyInvoices,
  reportPayment,
  createCheckoutSession,
  assertCanCreateField,
  assertCanAddSubField,
};
