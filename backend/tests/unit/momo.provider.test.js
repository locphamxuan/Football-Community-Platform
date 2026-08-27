process.env.MOMO_PARTNER_CODE = 'TESTPARTNER01';
process.env.MOMO_ACCESS_KEY = 'TEST_ACCESS_KEY';
process.env.MOMO_SECRET_KEY = 'TEST_SECRET_KEY_XYZ789';
process.env.MOMO_URL = 'https://test-payment.momo.vn/v2/gateway/api/create';
process.env.MOMO_IPN_URL = 'http://localhost:5001/webhooks/payments/momo/ipn';
process.env.MOMO_REDIRECT_URL = 'http://localhost:3001/owner/billing';

const crypto = require('crypto');
const momo = require('../../src/services/payments/momo.provider');

/** Ký lại rawSignature y hệt provider, dùng để dựng fixture IPN/return hợp lệ. */
const signIpn = (params) => {
  const raw = `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${params.amount}&extraData=${params.extraData ?? ''}`
    + `&message=${params.message}&orderId=${params.orderId}&orderInfo=${params.orderInfo}`
    + `&orderType=${params.orderType}&partnerCode=${params.partnerCode}&payType=${params.payType}`
    + `&requestId=${params.requestId}&responseTime=${params.responseTime}&resultCode=${params.resultCode}`
    + `&transId=${params.transId}`;
  return crypto.createHmac('sha256', process.env.MOMO_SECRET_KEY).update(raw).digest('hex');
};

afterEach(() => {
  delete global.fetch;
});

describe('isConfigured', () => {
  it('true khi có đủ partner code, access key và secret key', () => {
    expect(momo.isConfigured()).toBe(true);
  });
});

describe('createPaymentUrl', () => {
  it('gọi API MoMo /create và trả về payUrl từ response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ payUrl: 'https://test-payment.momo.vn/pay?token=abc' }),
    });

    const url = await momo.createPaymentUrl(
      { txnRef: 'INV-001-ABC', amount: 299000, orderInfo: 'Thanh toan hoa don INV-001' },
      { ipAddr: '127.0.0.1' }
    );

    expect(url).toBe('https://test-payment.momo.vn/pay?token=abc');
    expect(global.fetch).toHaveBeenCalledWith(
      process.env.MOMO_URL,
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.orderId).toBe('INV-001-ABC');
    expect(body.requestId).toBe('INV-001-ABC');
    expect(body.amount).toBe(299000);
    expect(body.partnerCode).toBe('TESTPARTNER01');
    expect(body.signature).toBeTruthy();
  });

  it('MoMo trả lỗi (không có payUrl) thì ném lỗi thay vì trả undefined', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ resultCode: 1, message: 'Invalid signature' }),
    });

    await expect(
      momo.createPaymentUrl({ txnRef: 'INV-002', amount: 100000, orderInfo: 'Test' }, { ipAddr: '1.2.3.4' })
    ).rejects.toThrow(/MoMo create payment failed/);
  });
});

describe('verifySignature', () => {
  const baseParams = {
    amount: '100000',
    extraData: '',
    message: 'Successful.',
    orderId: 'INV-003',
    orderInfo: 'Test',
    orderType: 'momo_wallet',
    partnerCode: 'TESTPARTNER01',
    payType: 'qr',
    requestId: 'INV-003',
    responseTime: '1700000000000',
    resultCode: '0',
    transId: '9988776655',
  };

  it('chữ ký hợp lệ thì true', () => {
    const query = { ...baseParams, signature: signIpn(baseParams) };
    expect(momo.verifySignature(query)).toBe(true);
  });

  it('sửa một field sau khi ký thì false', () => {
    const query = { ...baseParams, amount: '999999', signature: signIpn(baseParams) };
    expect(momo.verifySignature(query)).toBe(false);
  });

  it('thiếu signature thì false, không ném lỗi', () => {
    expect(momo.verifySignature(baseParams)).toBe(false);
  });

  it('chữ ký ngắn hơn/dài hơn thì false thay vì crash timingSafeEqual', () => {
    const query = { ...baseParams, signature: 'abc' };
    expect(momo.verifySignature(query)).toBe(false);
  });
});

describe('isSuccess', () => {
  it('resultCode 0 (số) thì true', () => {
    expect(momo.isSuccess({ resultCode: 0 })).toBe(true);
  });

  it('resultCode "0" (chuỗi, từ query return URL) thì true', () => {
    expect(momo.isSuccess({ resultCode: '0' })).toBe(true);
  });

  it('resultCode khác 0 thì false', () => {
    expect(momo.isSuccess({ resultCode: 1006 })).toBe(false);
  });
});

describe('parseCallback', () => {
  it('rút đúng txnRef/amount/transactionId', () => {
    const result = momo.parseCallback({ orderId: 'INV-004', amount: '500000', transId: '99887766' });
    expect(result).toEqual({ txnRef: 'INV-004', amount: 500000, transactionId: '99887766' });
  });
});
