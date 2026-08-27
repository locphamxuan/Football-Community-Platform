const crypto = require('crypto');
const env = require('../../config/env');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');

const name = 'momo';

const isConfigured = () => Boolean(env.MOMO_PARTNER_CODE && env.MOMO_ACCESS_KEY && env.MOMO_SECRET_KEY);

const sign = (rawSignature) => crypto
  .createHmac('sha256', env.MOMO_SECRET_KEY)
  .update(rawSignature)
  .digest('hex');

/** @type {import('./provider.interface').PaymentProvider} */
const momoProvider = {
  name,
  isConfigured,

  /**
   * Khác VNPay: MoMo không cho tự ký URL tại chỗ, phải gọi API `/create` của MoMo trước để lấy
   * `payUrl` — nên hàm này là async trong khi VNPay là sync (interface cho phép cả hai, xem
   * `owner.js` đã `await` sẵn).
   */
  async createPaymentUrl({ txnRef, amount, orderInfo }) {
    const requestId = txnRef;
    const orderId = txnRef;
    const requestType = 'captureWallet';
    const extraData = '';
    const roundedAmount = Math.round(amount);

    // Thứ tự field trong chuỗi ký là bắt buộc theo tài liệu MoMo, không phải sort alphabet như VNPay.
    const rawSignature = `accessKey=${env.MOMO_ACCESS_KEY}&amount=${roundedAmount}&extraData=${extraData}`
      + `&ipnUrl=${env.MOMO_IPN_URL}&orderId=${orderId}&orderInfo=${orderInfo}`
      + `&partnerCode=${env.MOMO_PARTNER_CODE}&redirectUrl=${env.MOMO_REDIRECT_URL}`
      + `&requestId=${requestId}&requestType=${requestType}`;

    const res = await fetch(env.MOMO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerCode: env.MOMO_PARTNER_CODE,
        accessKey: env.MOMO_ACCESS_KEY,
        requestId,
        amount: roundedAmount,
        orderId,
        orderInfo,
        redirectUrl: env.MOMO_REDIRECT_URL,
        ipnUrl: env.MOMO_IPN_URL,
        extraData,
        requestType,
        signature: sign(rawSignature),
        lang: 'vi',
      }),
    });
    const data = await res.json();

    if (!data.payUrl) {
      throw new AppError(
        `MoMo create payment failed: ${data.message || res.status}`,
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE
      );
    }
    return data.payUrl;
  },

  verifySignature(query) {
    const receivedSignature = query.signature;
    if (!receivedSignature) return false;
    const rawSignature = `accessKey=${env.MOMO_ACCESS_KEY}&amount=${query.amount}&extraData=${query.extraData ?? ''}`
      + `&message=${query.message}&orderId=${query.orderId}&orderInfo=${query.orderInfo}`
      + `&orderType=${query.orderType}&partnerCode=${query.partnerCode}&payType=${query.payType}`
      + `&requestId=${query.requestId}&responseTime=${query.responseTime}&resultCode=${query.resultCode}`
      + `&transId=${query.transId}`;
    const expectedSignature = sign(rawSignature);
    // Độ dài khác nhau thì timingSafeEqual ném lỗi thay vì trả false — chặn trước bằng so độ dài.
    if (expectedSignature.length !== receivedSignature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature));
  },

  isSuccess(query) {
    return String(query.resultCode) === '0';
  },

  parseCallback(query) {
    return {
      txnRef: query.orderId,
      amount: Number(query.amount),
      transactionId: String(query.transId),
    };
  },
};

module.exports = momoProvider;
