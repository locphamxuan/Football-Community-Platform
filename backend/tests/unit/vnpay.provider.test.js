process.env.VNPAY_TMN_CODE = 'TESTCODE01';
process.env.VNPAY_HASH_SECRET = 'TEST_SECRET_KEY_ABC123';
process.env.VNPAY_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
process.env.VNPAY_RETURN_URL = 'http://localhost:3001/owner/billing';

const vnpay = require('../../src/services/payments/vnpay.provider');

/** Ký lại một query object y hệt provider ký khi tạo URL, dùng để dựng fixture IPN/return hợp lệ. */
const sign = (params) => {
  // eslint-disable-next-line global-require
  const crypto = require('crypto');
  const str = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&');
  return crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET).update(Buffer.from(str, 'utf-8')).digest('hex');
};

describe('isConfigured', () => {
  it('true khi có đủ TMN code và hash secret', () => {
    expect(vnpay.isConfigured()).toBe(true);
  });
});

describe('createPaymentUrl', () => {
  it('trả về URL trỏ đúng VNPAY_URL kèm chữ ký', () => {
    const url = vnpay.createPaymentUrl(
      { txnRef: 'INV-001-ABC', amount: 299000, orderInfo: 'Thanh toan hoa don INV-001' },
      { ipAddr: '127.0.0.1' }
    );

    expect(url.startsWith('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?')).toBe(true);
    const query = Object.fromEntries(new URL(url).searchParams.entries());
    expect(query.vnp_TmnCode).toBe('TESTCODE01');
    expect(query.vnp_TxnRef).toBe('INV-001-ABC');
    expect(query.vnp_Amount).toBe('29900000'); // ×100, VNPay tính bằng "xu"
    expect(query.vnp_SecureHash).toBeTruthy();
  });

  it('chữ ký tự xác minh lại được ngay sau khi tạo (round-trip)', () => {
    const url = vnpay.createPaymentUrl(
      { txnRef: 'INV-002', amount: 100000, orderInfo: 'Test' },
      { ipAddr: '1.2.3.4' }
    );
    const query = Object.fromEntries(new URL(url).searchParams.entries());

    expect(vnpay.verifySignature(query)).toBe(true);
  });
});

describe('verifySignature', () => {
  const baseParams = {
    vnp_Amount: '10000000',
    vnp_ResponseCode: '00',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: 'INV-003',
    vnp_TransactionNo: '14000123',
  };

  it('chữ ký hợp lệ thì true', () => {
    const query = { ...baseParams, vnp_SecureHash: sign(baseParams) };
    expect(vnpay.verifySignature(query)).toBe(true);
  });

  it('sửa một field sau khi ký thì false', () => {
    const query = { ...baseParams, vnp_Amount: '99999999', vnp_SecureHash: sign(baseParams) };
    expect(vnpay.verifySignature(query)).toBe(false);
  });

  it('thiếu vnp_SecureHash thì false, không ném lỗi', () => {
    expect(vnpay.verifySignature(baseParams)).toBe(false);
  });

  it('chữ ký ngắn hơn/dài hơn thì false thay vì crash timingSafeEqual', () => {
    const query = { ...baseParams, vnp_SecureHash: 'abc' };
    expect(vnpay.verifySignature(query)).toBe(false);
  });
});

describe('isSuccess', () => {
  it('ResponseCode và TransactionStatus đều 00 thì true', () => {
    expect(vnpay.isSuccess({ vnp_ResponseCode: '00', vnp_TransactionStatus: '00' })).toBe(true);
  });

  it('ResponseCode khác 00 thì false', () => {
    expect(vnpay.isSuccess({ vnp_ResponseCode: '24', vnp_TransactionStatus: '02' })).toBe(false);
  });
});

describe('parseCallback', () => {
  it('rút đúng txnRef/amount/transactionId, amount chia lại 100', () => {
    const result = vnpay.parseCallback({
      vnp_TxnRef: 'INV-004', vnp_Amount: '50000000', vnp_TransactionNo: '99887766',
    });
    expect(result).toEqual({ txnRef: 'INV-004', amount: 500000, transactionId: '99887766' });
  });
});
