jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/billing.service');

const request = require('supertest');
const app = require('../../src/app');
const billingService = require('../../src/services/billing.service');
const { asUser, asOwner, asAdmin, USER_ID } = require('../helpers/auth');
const { PLAN_CODES } = require('../../src/constants/plans');

const INVOICE_ID = '000000000000000000000060';

describe('GET /api/v1/billing/plans', () => {
  it('công khai, không cần đăng nhập', async () => {
    const res = await request(app).get('/api/v1/billing/plans');

    expect(res.status).toBe(200);
    expect(res.body.data.plans.map((p) => p.code)).toEqual(PLAN_CODES);
  });

  it('mỗi gói có đủ code, tên, giá và hạn mức', async () => {
    const { body } = await request(app).get('/api/v1/billing/plans');

    for (const plan of body.data.plans) {
      expect(plan).toEqual(expect.objectContaining({
        code: expect.any(String),
        name: expect.any(String),
        monthlyPrice: expect.any(Number),
        maxFields: expect.any(Number),
        maxSubFieldsPerField: expect.any(Number),
      }));
    }
  });
});

describe('phân quyền khu thuê bao', () => {
  it.each([
    ['get', '/api/v1/billing/subscription'],
    ['patch', '/api/v1/billing/subscription/plan'],
    ['patch', '/api/v1/billing/subscription/auto-renew'],
    ['get', '/api/v1/billing/invoices'],
    ['post', `/api/v1/billing/invoices/${INVOICE_ID}/report-payment`],
  ])('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });

  it('người dùng thường không xem được thuê bao', async () => {
    const res = await request(app).get('/api/v1/billing/subscription').set(asUser());

    expect(res.status).toBe(403);
    expect(billingService.getMySubscription).not.toHaveBeenCalled();
  });

  it('admin cũng vào được khu thuê bao', async () => {
    billingService.getMySubscription.mockResolvedValue({ subscription: {}, usage: {} });

    const res = await request(app).get('/api/v1/billing/subscription').set(asAdmin());

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/billing/subscription', () => {
  it('trả thuê bao, hạn mức đang dùng và công nợ', async () => {
    billingService.getMySubscription.mockResolvedValue({
      subscription: { plan: 'basic' },
      usage: { totalFields: 2 },
      outstandingAmount: 299000,
    });

    const res = await request(app).get('/api/v1/billing/subscription').set(asOwner());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ outstandingAmount: 299000 });
    expect(billingService.getMySubscription).toHaveBeenCalledWith(USER_ID);
  });
});

describe('PATCH /api/v1/billing/subscription/plan', () => {
  it.each(PLAN_CODES)('nhận gói %s', async (plan) => {
    billingService.changePlan.mockResolvedValue({ subscription: {}, plan: {}, invoice: null });

    const res = await request(app).patch('/api/v1/billing/subscription/plan').set(asOwner()).send({ plan });

    expect(res.status).toBe(200);
    expect(billingService.changePlan).toHaveBeenCalledWith(USER_ID, plan);
  });

  it('từ chối gói không tồn tại', async () => {
    const res = await request(app)
      .patch('/api/v1/billing/subscription/plan')
      .set(asOwner())
      .send({ plan: 'enterprise' });

    expect(res.status).toBe(400);
    expect(billingService.changePlan).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/billing/subscription/auto-renew', () => {
  it('tắt tự động gia hạn', async () => {
    billingService.setAutoRenew.mockResolvedValue({ autoRenew: false });

    const res = await request(app)
      .patch('/api/v1/billing/subscription/auto-renew')
      .set(asOwner())
      .send({ autoRenew: false });

    expect(res.status).toBe(200);
    expect(billingService.setAutoRenew).toHaveBeenCalledWith(USER_ID, false);
  });

  it('autoRenew phải là boolean', async () => {
    const res = await request(app)
      .patch('/api/v1/billing/subscription/auto-renew')
      .set(asOwner())
      .send({ autoRenew: 'false' });

    expect(res.status).toBe(400);
  });
});

describe('hoá đơn của chủ sân', () => {
  it('lọc theo trạng thái hợp lệ', async () => {
    billingService.getMyInvoices.mockResolvedValue({ invoices: [], total: 0, page: 1, limit: 10 });

    const res = await request(app).get('/api/v1/billing/invoices').query({ status: 'pending' }).set(asOwner());

    expect(res.status).toBe(200);
    expect(billingService.getMyInvoices).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ status: 'pending' }));
  });

  it('từ chối trạng thái lạ', async () => {
    const res = await request(app).get('/api/v1/billing/invoices').query({ status: 'refunded' }).set(asOwner());

    expect(res.status).toBe(400);
  });

  it('báo đã chuyển khoản kèm mã giao dịch', async () => {
    billingService.reportPayment.mockResolvedValue({ status: 'awaiting_confirmation' });

    const res = await request(app)
      .post(`/api/v1/billing/invoices/${INVOICE_ID}/report-payment`)
      .set(asOwner())
      .send({ paymentReference: 'FT26081234567' });

    expect(res.status).toBe(200);
    expect(billingService.reportPayment).toHaveBeenCalledWith(USER_ID, INVOICE_ID, 'FT26081234567');
  });

  it('mã giao dịch quá ngắn bị từ chối', async () => {
    const res = await request(app)
      .post(`/api/v1/billing/invoices/${INVOICE_ID}/report-payment`)
      .set(asOwner())
      .send({ paymentReference: 'x' });

    expect(res.status).toBe(400);
    expect(billingService.reportPayment).not.toHaveBeenCalled();
  });
});
