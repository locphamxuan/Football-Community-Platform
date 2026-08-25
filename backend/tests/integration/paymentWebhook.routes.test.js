jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/billing.service');

const request = require('supertest');
const app = require('../../src/app');
const billingService = require('../../src/services/billing.service');

describe('GET /webhooks/payments/vnpay/ipn', () => {
  it('không cần token — nằm ngoài /api/v1', async () => {
    billingService.handleGatewayIpn.mockResolvedValue({ rspCode: '00', message: 'Confirm Success' });

    const res = await request(app).get('/webhooks/payments/vnpay/ipn').query({ vnp_TxnRef: 'INV-001' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(billingService.handleGatewayIpn).toHaveBeenCalledWith('vnpay', expect.objectContaining({ vnp_TxnRef: 'INV-001' }));
  });

  it('chữ ký sai vẫn trả HTTP 200 kèm RspCode 97 — VNPay chỉ hiểu JSON body, không hiểu HTTP status khác', async () => {
    billingService.handleGatewayIpn.mockResolvedValue({ rspCode: '97', message: 'Invalid signature' });

    const res = await request(app).get('/webhooks/payments/vnpay/ipn').query({ vnp_TxnRef: 'INV-001' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ RspCode: '97', Message: 'Invalid signature' });
  });

  it('service ném lỗi bất ngờ thì vẫn trả JSON hợp lệ (RspCode 99), không crash', async () => {
    billingService.handleGatewayIpn.mockRejectedValue(new Error('boom'));

    const res = await request(app).get('/webhooks/payments/vnpay/ipn').query({ vnp_TxnRef: 'INV-001' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ RspCode: '99', Message: 'Unknown error' });
  });
});

describe('GET /webhooks/payments/vnpay/return', () => {
  it('thành công thì redirect về trang billing kèm payment=success', async () => {
    billingService.handleGatewayReturn.mockReturnValue({ success: true });

    const res = await request(app).get('/webhooks/payments/vnpay/return').query({ vnp_ResponseCode: '00' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/owner\/billing\?payment=success$/);
  });

  it('thất bại hoặc chữ ký sai thì redirect kèm payment=failed', async () => {
    billingService.handleGatewayReturn.mockReturnValue({ success: false });

    const res = await request(app).get('/webhooks/payments/vnpay/return').query({ vnp_ResponseCode: '24' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/owner\/billing\?payment=failed$/);
  });

  it('service ném lỗi thì vẫn redirect về failed thay vì lộ trang lỗi 500', async () => {
    billingService.handleGatewayReturn.mockImplementation(() => { throw new Error('boom'); });

    const res = await request(app).get('/webhooks/payments/vnpay/return').query({});

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/owner\/billing\?payment=failed$/);
  });
});
