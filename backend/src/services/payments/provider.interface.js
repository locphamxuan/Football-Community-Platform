/**
 * Hợp đồng mà mọi cổng thanh toán (VNPay, MoMo, ...) phải cài đặt.
 * billing.service.js chỉ gọi qua interface này — thêm cổng mới không phải sửa luồng nghiệp vụ.
 *
 * @typedef {Object} PaymentProvider
 * @property {string} name - Tên cổng, khớp `PaymentTransaction.provider` / `Invoice.paymentProvider`.
 * @property {(txn: { txnRef: string, amount: number, orderInfo: string }, ctx: { ipAddr: string }) => string} createPaymentUrl
 *   Trả về URL để redirect người dùng sang trang thanh toán của cổng.
 * @property {(query: Record<string, string>) => boolean} verifySignature
 *   Xác minh chữ ký của query string cổng gửi về (return URL hoặc IPN).
 * @property {(query: Record<string, string>) => boolean} isSuccess
 *   Cổng có báo giao dịch thành công không (chỉ gọi sau khi `verifySignature` đã qua).
 * @property {(query: Record<string, string>) => { txnRef: string, amount: number, transactionId: string }} parseCallback
 *   Rút ra txnRef/amount/mã giao dịch từ query — mỗi cổng đặt tên field khác nhau.
 */

module.exports = {};
