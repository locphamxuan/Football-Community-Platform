jest.mock('../../src/models/Subscription', () => ({ findOne: jest.fn(), findById: jest.fn(), create: jest.fn() }));
jest.mock('../../src/models/Invoice', () => ({
  find: jest.fn(), findById: jest.fn(), create: jest.fn(),
  countDocuments: jest.fn(), updateMany: jest.fn(),
}));
jest.mock('../../src/models/Field', () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../src/models/Booking', () => ({ countDocuments: jest.fn(), aggregate: jest.fn() }));

const Subscription = require('../../src/models/Subscription');
const Invoice = require('../../src/models/Invoice');
const Field = require('../../src/models/Field');
const Booking = require('../../src/models/Booking');
const billingService = require('../../src/services/billing.service');
const { PlanCode, SubscriptionStatus, InvoiceStatus } = require('../../src/constants/plans');

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

    const result = await billingService.voidInvoice(INVOICE_ID, 'Phát hành nhầm');

    expect(result.status).toBe(InvoiceStatus.VOID);
    expect(result.voidReason).toBe('Phát hành nhầm');
  });

  it('không huỷ hoá đơn đã thu tiền', async () => {
    Invoice.findById.mockResolvedValue(fakeInvoice({ status: InvoiceStatus.PAID }));

    await expect(billingService.voidInvoice(INVOICE_ID)).rejects.toMatchObject({ code: 'INVOICE_NOT_PAYABLE' });
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
