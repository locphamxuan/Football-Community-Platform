const crypto = require('crypto');
const env = require('../../config/env');

const name = 'vnpay';

const isConfigured = () => Boolean(env.VNPAY_TMN_CODE && env.VNPAY_HASH_SECRET);

/** Giờ Việt Nam (UTC+7) bất kể múi giờ máy chủ, định dạng VNPay yêu cầu: yyyyMMddHHmmss. */
const formatVnpDate = (date) => {
  const vn = new Date(date.getTime() + 7 * 3600000);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${vn.getUTCFullYear()}${pad(vn.getUTCMonth() + 1)}${pad(vn.getUTCDate())}`
    + `${pad(vn.getUTCHours())}${pad(vn.getUTCMinutes())}${pad(vn.getUTCSeconds())}`
  );
};

/**
 * Chuẩn ký của VNPay: sort key theo alphabet, encode cả key lẫn value, khoảng trắng thành `+`
 * (không phải `%20`), nối bằng `&` — không dùng `qs`/`querystring` vì hai thư viện đó không
 * cho encode value kiểu VNPay yêu cầu (`+` thay vì `%20`) mà không đụng luôn cả dấu `&`/`=`.
 */
const buildSignableString = (params) => Object.keys(params)
  .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
  .sort()
  .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
  .join('&');

const sign = (params) => crypto
  .createHmac('sha512', env.VNPAY_HASH_SECRET)
  .update(Buffer.from(buildSignableString(params), 'utf-8'))
  .digest('hex');

/** @type {import('./provider.interface').PaymentProvider} */
const vnpayProvider = {
  name,
  isConfigured,

  createPaymentUrl({ txnRef, amount, orderInfo }, { ipAddr }) {
    const params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      // VNPay tính bằng đơn vị "xu" (giá thật × 100), VND không có phần lẻ nên không mất độ chính xác.
      vnp_Amount: Math.round(amount * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: env.VNPAY_RETURN_URL,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: formatVnpDate(new Date()),
    };

    const secureHash = sign(params);
    const query = `${buildSignableString(params)}&vnp_SecureHash=${secureHash}`;
    return `${env.VNPAY_URL}?${query}`;
  },

  verifySignature(query) {
    const receivedHash = query.vnp_SecureHash;
    if (!receivedHash) return false;
    const rest = { ...query };
    delete rest.vnp_SecureHash;
    delete rest.vnp_SecureHashType;
    const expectedHash = sign(rest);
    // Độ dài khác nhau thì timingSafeEqual ném lỗi thay vì trả false — chặn trước bằng so độ dài.
    if (expectedHash.length !== receivedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(receivedHash.toLowerCase()));
  },

  isSuccess(query) {
    return query.vnp_ResponseCode === '00' && (query.vnp_TransactionStatus == null || query.vnp_TransactionStatus === '00');
  },

  parseCallback(query) {
    return {
      txnRef: query.vnp_TxnRef,
      amount: Number(query.vnp_Amount) / 100,
      transactionId: query.vnp_TransactionNo || query.vnp_TxnRef,
    };
  },
};

module.exports = vnpayProvider;
