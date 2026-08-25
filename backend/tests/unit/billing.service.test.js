// Thông báo có test riêng ở notification.service.test.js; ở đây chỉ cần nó không chạm Mongo.
jest.mock('../../src/services/notification.service');
// Audit log có test riêng ở adminAuditLog.service.test.js; ở đây chỉ cần xác nhận có gọi.
jest.mock('../../src/services/adminAuditLog.service');
jest.mock('../../src/models/Subscription', () => ({ findOne: jest.fn(), findById: jest.fn(), create: jest.fn() }));
jest.mock('../../src/models/Invoice', () => ({
  find: jest.fn(), findById: jest.fn(), create: jest.fn(),
  countDocuments: jest.fn(), updateMany: jest.fn(),
}));
jest.mock('../../src/models/Field', () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../src/models/Booking', () => ({ countDocuments: jest.fn(), aggregate: jest.fn() }));
jest.mock('../../src/models/PaymentTransaction', () => ({
  create: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn(),
}));
jest.mock('../../src/services/payments', () => ({ getProvider: jest.fn() }));

const Subscription = require('../../src/models/Subscription');
const Invoice = require('../../src/models/Invoice');
const Field = require('../../src/models/Field');
const Booking = require('../../src/models/Booking');
const PaymentTransaction = require('../../src/models/PaymentTransaction');
const { getProvider } = require('../../src/services/payments');
const billingService = require('../../src/services/billing.service');
const { notify } = require('../../src/services/notification.service');
const adminAuditLogService = require('../../src/services/adminAuditLog.service');
const { PlanCode, SubscriptionStatus, InvoiceStatus } = require('../../src/constants/plans');
const { AdminAction, AdminTargetType } = require('../../src/constants/adminAudit');

const OWNER_ID = '000000000000000000000002';
const ADMIN_ID = '000000000000000000000009';
const INVOICE_ID = '000000000000000000000060';

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

/**
 * Bản ghi thuê bao giả mang đủ những gì service dùng: save(), isModified().
 * `modified` bật lên khi service gán lại field, đúng như tài liệu mongoose.
 */
const fakeSubscription = (overrides = {}) => {
  const doc = {
    _id: '000000000000000000000070',
    owner: OWNER_ID,
    plan: PlanCode.FREE,
    status: SubscriptionStatus.ACTIVE,
    autoRenew: true,
    totalPaid: 0,
    currentPeriodStart: daysAgo(30),
    currentPeriodEnd: new Date(Date.now() + 86400000),
    save: jest.fn().mockResolvedValue(undefined),
    isModified: jest.fn().mockReturnValue(true),
    ...overrides,
  };
  return doc;
};

const fakeInvoice = (overrides = {}) => ({
  _id: INVOICE_ID,
  owner: { toString: () => OWNER_ID },
  subscription: '000000000000000000000070',
  amount: 299000,
  status: InvoiceStatus.PENDING,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

/** Không có sân nào — dùng cho các test không quan tâm tới hạn mức. */
const noFields = () => {
  Field.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
  Field.countDocuments.mockResolvedValue(0);
};

beforeEach(() => {
  noFields();
  Booking.countDocuments.mockResolvedValue(0);
  Booking.aggregate.mockResolvedValue([]);
  Invoice.create.mockResolvedValue(fakeInvoice());
  Invoice.updateMany.mockResolvedValue({ modifiedCount: 0 });
  Invoice.countDocuments.mockResolvedValue(0);
});

describe('ensureSubscription', () => {
  it('chủ sân chưa có thuê bao thì được tạo gói miễn phí', async () => {
    Subscription.findOne.mockResolvedValue(null);
    Subscription.create.mockImplementation((data) => Promise.resolve(fakeSubscription(data)));

    const sub = await billingService.ensureSubscription(OWNER_ID);

    expect(sub.plan).toBe(PlanCode.FREE);
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('chu kỳ còn hạn thì không đụng gì tới thuê bao', async () => {
    const sub = fakeSubscription({ isModified: jest.fn().mockReturnValue(false) });
    Subscription.findOne.mockResolvedValue(sub);

    await billingService.ensureSubscription(OWNER_ID);

    expect(sub.save).not.toHaveBeenCalled();
    expect(Invoice.create).not.toHaveBeenCalled();
  });

  it('gói miễn phí hết hạn thì tự gia hạn, không phát hành hoá đơn', async () => {
    const sub = fakeSubscription({ currentPeriodEnd: daysAgo(1) });
    Subscription.findOne.mockResolvedValue(sub);

    const result = await billingService.ensureSubscription(OWNER_ID);

    expect(result.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now());
    expect(Invoice.create).not.toHaveBeenCalled();
    expect(sub.save).toHaveBeenCalled();
  });

  it('gói trả phí còn tự động gia hạn thì phát hành hoá đơn và chuyển sang nợ', async () => {
    const sub = fakeSubscription({ plan: PlanCode.BASIC, currentPeriodEnd: daysAgo(1) });
    Subscription.findOne.mockResolvedValue(sub);

    const result = await billingService.ensureSubscription(OWNER_ID);

    expect(result.status).toBe(SubscriptionStatus.PAST_DUE);
    expect(Invoice.create).toHaveBeenCalledTimes(1);
    expect(Invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      plan: PlanCode.BASIC, amount: 299000, status: InvoiceStatus.PENDING,
    }));
  });

  it('gói trả phí đã tắt gia hạn thì rơi về miễn phí, không tính tiền', async () => {
    const sub = fakeSubscription({ plan: PlanCode.PRO, autoRenew: false, currentPeriodEnd: daysAgo(1) });
    Subscription.findOne.mockResolvedValue(sub);

    const result = await billingService.ensureSubscription(OWNER_ID);

    expect(result.plan).toBe(PlanCode.FREE);
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    expect(Invoice.create).not.toHaveBeenCalled();
  });

  it('bỏ quên nhiều năm cũng không phát hành quá 12 hoá đơn một lần', async () => {
    const sub = fakeSubscription({ plan: PlanCode.BASIC, currentPeriodEnd: daysAgo(365 * 3) });
    Subscription.findOne.mockResolvedValue(sub);

    await billingService.ensureSubscription(OWNER_ID);

    expect(Invoice.create).toHaveBeenCalledTimes(12);
  });
});

describe('changePlan', () => {
  beforeEach(() => {
    Subscription.findOne.mockResolvedValue(fakeSubscription());
  });

  it('đang ở đúng gói đó thì báo lỗi', async () => {
    await expect(billingService.changePlan(OWNER_ID, PlanCode.FREE))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('không hạ gói khi số sân đang vượt hạn mức gói mới', async () => {
    Subscription.findOne.mockResolvedValue(fakeSubscription({ plan: PlanCode.PRO }));
    Field.find.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([{ _id: 1 }, { _id: 2 }, { _id: 3 }]) }),
    });

    await expect(billingService.changePlan(OWNER_ID, PlanCode.FREE))
      .rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
  });

  it('lên gói trả phí thì phát hành hoá đơn và chờ thanh toán', async () => {
    const result = await billingService.changePlan(OWNER_ID, PlanCode.BASIC);

    expect(result.subscription.status).toBe(SubscriptionStatus.PAST_DUE);
    expect(result.invoice).not.toBeNull();
    expect(result.plan.code).toBe(PlanCode.BASIC);
  });

  it('huỷ các hoá đơn chưa thanh toán của gói cũ', async () => {
    await billingService.changePlan(OWNER_ID, PlanCode.BASIC);

    expect(Invoice.updateMany).toHaveBeenCalledWith(
      { owner: OWNER_ID, status: InvoiceStatus.PENDING },
      expect.objectContaining({ status: InvoiceStatus.VOID })
    );
  });

  it('về gói miễn phí thì kích hoạt ngay, không hoá đơn', async () => {
    Subscription.findOne.mockResolvedValue(fakeSubscription({ plan: PlanCode.BASIC }));

    const result = await billingService.changePlan(OWNER_ID, PlanCode.FREE);

    expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(result.invoice).toBeNull();
  });
});

describe('reportPayment', () => {
  it('chuyển hoá đơn sang chờ đối soát kèm mã giao dịch', async () => {
    const invoice = fakeInvoice();
    Invoice.findById.mockResolvedValue(invoice);

    const result = await billingService.reportPayment(OWNER_ID, INVOICE_ID, 'FT123456');

    expect(result.status).toBe(InvoiceStatus.AWAITING_CONFIRMATION);
    expect(result.paymentReference).toBe('FT123456');
    expect(invoice.save).toHaveBeenCalled();
  });

  it('không báo hộ hoá đơn của chủ sân khác', async () => {
    Invoice.findById.mockResolvedValue(fakeInvoice({ owner: { toString: () => 'chu-san-khac' } }));

    await expect(billingService.reportPayment(OWNER_ID, INVOICE_ID, 'FT123456'))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([InvoiceStatus.PAID, InvoiceStatus.VOID, InvoiceStatus.AWAITING_CONFIRMATION])(
    'hoá đơn đang ở trạng thái %s thì không báo lại được',
    async (status) => {
      Invoice.findById.mockResolvedValue(fakeInvoice({ status }));

      await expect(billingService.reportPayment(OWNER_ID, INVOICE_ID, 'FT123456'))
        .rejects.toMatchObject({ code: 'INVOICE_NOT_PAYABLE' });
    }
  );
});

describe('confirmInvoicePayment', () => {
  it('ghi nhận tiền và cộng vào tổng đã trả', async () => {
    const invoice = fakeInvoice({ status: InvoiceStatus.AWAITING_CONFIRMATION });
    const sub = fakeSubscription({ status: SubscriptionStatus.PAST_DUE });
    Invoice.findById.mockResolvedValue(invoice);
    Subscription.findById.mockResolvedValue(sub);

    const result = await billingService.confirmInvoicePayment(INVOICE_ID, ADMIN_ID);

    expect(result.status).toBe(InvoiceStatus.PAID);
    expect(sub.totalPaid).toBe(299000);
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(adminAuditLogService.record).toHaveBeenCalledWith(
      ADMIN_ID, AdminAction.INVOICE_CONFIRMED, AdminTargetType.INVOICE, INVOICE_ID, expect.any(Object)
    );
  });

  it('còn hoá đơn nợ khác thì thuê bao vẫn ở trạng thái nợ', async () => {
    const sub = fakeSubscription({ status: SubscriptionStatus.PAST_DUE });
    Invoice.findById.mockResolvedValue(fakeInvoice());
    Subscription.findById.mockResolvedValue(sub);
    Invoice.countDocuments.mockResolvedValue(2);

    await billingService.confirmInvoicePayment(INVOICE_ID, ADMIN_ID);

    expect(sub.status).toBe(SubscriptionStatus.PAST_DUE);
  });

  it('hoá đơn đã thanh toán thì không xác nhận lại', async () => {
    Invoice.findById.mockResolvedValue(fakeInvoice({ status: InvoiceStatus.PAID }));

    await expect(billingService.confirmInvoicePayment(INVOICE_ID, ADMIN_ID))
      .rejects.toMatchObject({ code: 'INVOICE_NOT_PAYABLE' });
  });

  it('hoá đơn không tồn tại trả 404', async () => {
    Invoice.findById.mockResolvedValue(null);

    await expect(billingService.confirmInvoicePayment(INVOICE_ID, ADMIN_ID))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('voidInvoice', () => {
  it('huỷ hoá đơn chưa thanh toán kèm lý do', async () => {
    Invoice.findById.mockResolvedValue(fakeInvoice());

    const result = await billingService.voidInvoice(INVOICE_ID, 'Phát hành nhầm', ADMIN_ID);

    expect(result.status).toBe(InvoiceStatus.VOID);
    expect(result.voidReason).toBe('Phát hành nhầm');
    expect(adminAuditLogService.record).toHaveBeenCalledWith(
      ADMIN_ID, AdminAction.INVOICE_VOIDED, AdminTargetType.INVOICE, INVOICE_ID, expect.any(Object)
    );
  });

  it('không huỷ hoá đơn đã thu tiền', async () => {
    Invoice.findById.mockResolvedValue(fakeInvoice({ status: InvoiceStatus.PAID }));

    await expect(billingService.voidInvoice(INVOICE_ID)).rejects.toMatchObject({ code: 'INVOICE_NOT_PAYABLE' });
  });
});

describe('createCheckoutSession', () => {
  const fakeProvider = () => ({
    name: 'vnpay',
    createPaymentUrl: jest.fn().mockReturnValue('https://sandbox.vnpayment.vn/pay?x=1'),
  });

  it('trả về paymentUrl và tạo một PaymentTransaction đang chờ', async () => {
    const provider = fakeProvider();
    getProvider.mockReturnValue(provider);
    Invoice.findById.mockResolvedValue(fakeInvoice());

    const result = await billingService.createCheckoutSession(OWNER_ID, INVOICE_ID, 'vnpay', '127.0.0.1');

    expect(result).toEqual({ paymentUrl: 'https://sandbox.vnpayment.vn/pay?x=1' });
    expect(PaymentTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      invoice: INVOICE_ID, provider: 'vnpay', amount: 299000,
    }));
    expect(provider.createPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 299000 }), { ipAddr: '127.0.0.1' }
    );
  });

  it('hoá đơn không thuộc chủ sân thì 403, không tạo giao dịch', async () => {
    getProvider.mockReturnValue(fakeProvider());
    Invoice.findById.mockResolvedValue(fakeInvoice({ owner: { toString: () => 'nguoi-khac' } }));

    await expect(billingService.createCheckoutSession(OWNER_ID, INVOICE_ID, 'vnpay', '127.0.0.1'))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(PaymentTransaction.create).not.toHaveBeenCalled();
  });

  it('hoá đơn đã thanh toán rồi thì không cho checkout lại', async () => {
    getProvider.mockReturnValue(fakeProvider());
    Invoice.findById.mockResolvedValue(fakeInvoice({ status: InvoiceStatus.PAID }));

    await expect(billingService.createCheckoutSession(OWNER_ID, INVOICE_ID, 'vnpay', '127.0.0.1'))
      .rejects.toMatchObject({ code: 'INVOICE_NOT_PAYABLE' });
  });

  it('cổng chưa cấu hình thì báo lỗi từ getProvider, không tạo giao dịch', async () => {
    Invoice.findById.mockResolvedValue(fakeInvoice());
    getProvider.mockImplementation(() => {
      const { AppError } = require('../../src/middleware/errorHandler');
      throw new AppError('Payment provider "vnpay" is not configured', 503, 'PAYMENT_PROVIDER_UNAVAILABLE');
    });

    await expect(billingService.createCheckoutSession(OWNER_ID, INVOICE_ID, 'vnpay', '127.0.0.1'))
      .rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
    expect(PaymentTransaction.create).not.toHaveBeenCalled();
  });
});

describe('confirmInvoicePaymentViaGateway', () => {
  it('ghi nhận thanh toán qua cổng và báo cho chủ sân', async () => {
    const invoice = fakeInvoice({ status: InvoiceStatus.AWAITING_CONFIRMATION });
    const sub = fakeSubscription({ status: SubscriptionStatus.PAST_DUE });
    Invoice.findById.mockResolvedValue(invoice);
    Subscription.findById.mockResolvedValue(sub);

    await billingService.confirmInvoicePaymentViaGateway(INVOICE_ID, { provider: 'vnpay', transactionId: 'TXN123' });

    expect(invoice.status).toBe(InvoiceStatus.PAID);
    expect(invoice.paymentProvider).toBe('vnpay');
    expect(invoice.gatewayTransactionId).toBe('TXN123');
    expect(invoice.confirmedBy).toBeUndefined();
    expect(sub.totalPaid).toBe(299000);
    expect(notify).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'invoice_paid' }));
  });

  it('hoá đơn đã paid rồi thì không xử lý lại (idempotent)', async () => {
    const invoice = fakeInvoice({ status: InvoiceStatus.PAID });
    Invoice.findById.mockResolvedValue(invoice);

    await billingService.confirmInvoicePaymentViaGateway(INVOICE_ID, { provider: 'vnpay', transactionId: 'TXN123' });

    expect(invoice.save).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('handleGatewayIpn', () => {
  const query = { vnp_TxnRef: 'INV-001-ABC', vnp_Amount: '29900000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: 'TXN1' };

  const fakeProvider = (overrides = {}) => ({
    name: 'vnpay',
    verifySignature: jest.fn().mockReturnValue(true),
    isSuccess: jest.fn().mockReturnValue(true),
    parseCallback: jest.fn().mockReturnValue({ txnRef: 'INV-001-ABC', amount: 299000, transactionId: 'TXN1' }),
    ...overrides,
  });

  it('chữ ký sai thì trả 97, không tra PaymentTransaction', async () => {
    getProvider.mockReturnValue(fakeProvider({ verifySignature: jest.fn().mockReturnValue(false) }));

    const result = await billingService.handleGatewayIpn('vnpay', query);

    expect(result).toEqual({ rspCode: '97', message: 'Invalid signature' });
    expect(PaymentTransaction.findOne).not.toHaveBeenCalled();
  });

  it('không tìm thấy giao dịch thì trả 01', async () => {
    getProvider.mockReturnValue(fakeProvider());
    PaymentTransaction.findOne.mockResolvedValue(null);

    const result = await billingService.handleGatewayIpn('vnpay', query);

    expect(result).toEqual({ rspCode: '01', message: 'Order not found' });
  });

  it('giao dịch đã xử lý rồi (gọi IPN trùng) thì trả 02, không cộng tiền lần hai', async () => {
    getProvider.mockReturnValue(fakeProvider());
    PaymentTransaction.findOne.mockResolvedValue({ _id: 'txn1', invoice: INVOICE_ID, amount: 299000, status: 'success' });

    const result = await billingService.handleGatewayIpn('vnpay', query);

    expect(result).toEqual({ rspCode: '02', message: 'Order already confirmed' });
    expect(PaymentTransaction.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('số tiền không khớp thì trả 04 và đánh dấu giao dịch thất bại', async () => {
    getProvider.mockReturnValue(fakeProvider());
    PaymentTransaction.findOne.mockResolvedValue({ _id: 'txn1', invoice: INVOICE_ID, amount: 500000, status: 'pending' });

    const result = await billingService.handleGatewayIpn('vnpay', query);

    expect(result).toEqual({ rspCode: '04', message: 'Invalid amount' });
    expect(PaymentTransaction.updateOne).toHaveBeenCalledWith(
      { _id: 'txn1', status: 'pending' }, expect.objectContaining({ status: 'failed' })
    );
  });

  it('giao dịch hợp lệ thì chuyển pending -> success và xác nhận hoá đơn', async () => {
    getProvider.mockReturnValue(fakeProvider());
    PaymentTransaction.findOne.mockResolvedValue({ _id: 'txn1', invoice: INVOICE_ID, amount: 299000, status: 'pending' });
    PaymentTransaction.findOneAndUpdate.mockResolvedValue({ _id: 'txn1', status: 'success' });
    Invoice.findById.mockResolvedValue(fakeInvoice());
    Subscription.findById.mockResolvedValue(fakeSubscription());

    const result = await billingService.handleGatewayIpn('vnpay', query);

    expect(result).toEqual({ rspCode: '00', message: 'Confirm Success' });
    expect(PaymentTransaction.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'txn1', status: 'pending' }, expect.objectContaining({ status: 'success' }), { new: true }
    );
  });

  it('hai IPN cùng lúc tranh nhau — request thua findOneAndUpdate trả 02, không xác nhận hoá đơn lần hai', async () => {
    getProvider.mockReturnValue(fakeProvider());
    PaymentTransaction.findOne.mockResolvedValue({ _id: 'txn1', invoice: INVOICE_ID, amount: 299000, status: 'pending' });
    PaymentTransaction.findOneAndUpdate.mockResolvedValue(null); // request kia đã thắng trước

    const result = await billingService.handleGatewayIpn('vnpay', query);

    expect(result).toEqual({ rspCode: '02', message: 'Order already confirmed' });
    expect(Invoice.findById).not.toHaveBeenCalled();
  });
});

describe('handleGatewayReturn', () => {
  it('chữ ký hợp lệ và giao dịch thành công thì success: true', () => {
    getProvider.mockReturnValue({
      verifySignature: jest.fn().mockReturnValue(true),
      isSuccess: jest.fn().mockReturnValue(true),
    });

    expect(billingService.handleGatewayReturn('vnpay', {})).toEqual({ success: true });
  });

  it('chữ ký sai thì success: false dù isSuccess có báo true', () => {
    getProvider.mockReturnValue({
      verifySignature: jest.fn().mockReturnValue(false),
      isSuccess: jest.fn().mockReturnValue(true),
    });

    expect(billingService.handleGatewayReturn('vnpay', {})).toEqual({ success: false });
  });
});

describe('hạn mức gói', () => {
  it('còn nợ hoá đơn thì không thêm sân mới', async () => {
    Subscription.findOne.mockResolvedValue(fakeSubscription({ status: SubscriptionStatus.PAST_DUE }));

    await expect(billingService.assertCanCreateField(OWNER_ID))
      .rejects.toMatchObject({ statusCode: 402, code: 'SUBSCRIPTION_PAST_DUE' });
  });

  it('gói miễn phí chỉ được một sân', async () => {
    Subscription.findOne.mockResolvedValue(fakeSubscription());
    Field.countDocuments.mockResolvedValue(1);

    await expect(billingService.assertCanCreateField(OWNER_ID))
      .rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
  });

  it('chưa có sân nào thì tạo được', async () => {
    Subscription.findOne.mockResolvedValue(fakeSubscription());

    await expect(billingService.assertCanCreateField(OWNER_ID)).resolves.toMatchObject({
      plan: expect.objectContaining({ code: PlanCode.FREE }),
    });
  });

  it('gói miễn phí chặn sân con thứ ba', async () => {
    Subscription.findOne.mockResolvedValue(fakeSubscription());

    await expect(billingService.assertCanAddSubField(OWNER_ID, 2))
      .rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
    await expect(billingService.assertCanAddSubField(OWNER_ID, 1)).resolves.toBeDefined();
  });

  it('gói pro nới hạn mức sân con lên 20', async () => {
    Subscription.findOne.mockResolvedValue(fakeSubscription({ plan: PlanCode.PRO }));

    await expect(billingService.assertCanAddSubField(OWNER_ID, 19)).resolves.toBeDefined();
    await expect(billingService.assertCanAddSubField(OWNER_ID, 20)).rejects.toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
    });
  });
});
