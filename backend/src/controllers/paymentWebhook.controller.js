const billingService = require('../services/billing');
const env = require('../config/env');
const logger = require('../utils/logger');
const catchAsync = require('../utils/catchAsync');

/**
 * IPN của VNPay — server-to-server, không JWT, không đi qua `/api` (xem app.js). Luôn trả
 * HTTP 200 với `{RspCode, Message}` đúng bảng mã VNPay yêu cầu; một lỗi bất ngờ ở đây chỉ nên
 * khiến VNPay retry, không phải một trang lỗi 500 mà nó không hiểu.
 */
const vnpayIpn = catchAsync(async (req, res) => {
  try {
    const result = await billingService.handleGatewayIpn('vnpay', req.query);
    res.status(200).json({ RspCode: result.rspCode, Message: result.message });
  } catch (err) {
    logger.error('VNPay IPN handling failed', { error: err.message });
    res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
});

/**
 * Return URL — trình duyệt người dùng quay lại đây sau khi thanh toán trên VNPay. Chỉ để
 * điều hướng UX; **không** dùng để xác nhận đơn (VNPay khuyến cáo chỉ tin IPN), nên chữ ký sai
 * hay lỗi bất ngờ cũng chỉ điều hướng về "failed", không throw ra một trang lỗi cho người dùng.
 */
const vnpayReturn = catchAsync(async (req, res) => {
  let success = false;
  try {
    ({ success } = billingService.handleGatewayReturn('vnpay', req.query));
  } catch (err) {
    logger.error('VNPay return handling failed', { error: err.message });
  }
  res.redirect(`${env.CLIENT_URL}/owner/billing?payment=${success ? 'success' : 'failed'}`);
});

/**
 * IPN của MoMo — server-to-server, POST JSON body (khác VNPay dùng GET query). MoMo chỉ cần
 * xác nhận đã nhận, không có bảng mã response riêng như VNPay nên luôn trả HTTP 204.
 */
const momoIpn = catchAsync(async (req, res) => {
  try {
    await billingService.handleGatewayIpn('momo', req.body);
  } catch (err) {
    logger.error('MoMo IPN handling failed', { error: err.message });
  }
  res.status(204).end();
});

/** Return URL của MoMo — cùng nguyên tắc với VNPay: chỉ điều hướng UX, không xác nhận đơn. */
const momoReturn = catchAsync(async (req, res) => {
  let success = false;
  try {
    ({ success } = billingService.handleGatewayReturn('momo', req.query));
  } catch (err) {
    logger.error('MoMo return handling failed', { error: err.message });
  }
  res.redirect(`${env.CLIENT_URL}/owner/billing?payment=${success ? 'success' : 'failed'}`);
});

module.exports = {
  vnpayIpn, vnpayReturn, momoIpn, momoReturn,
};
