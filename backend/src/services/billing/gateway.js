const Invoice = require('../../models/Invoice');
const PaymentTransaction = require('../../models/PaymentTransaction');
const { notify } = require('../notification.service');
const { getProvider } = require('../payments');
const { NotificationType } = require('../../constants/notifications');
const { InvoiceStatus } = require('../../constants/plans');
const { settleInvoice } = require('./shared');

/** Cổng xác nhận thanh toán thành công — không phải admin nên không ghi `confirmedBy`. */
const confirmInvoicePaymentViaGateway = async (invoiceId, { provider, transactionId }) => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice || invoice.status === InvoiceStatus.PAID) return; // idempotent no-op

  invoice.paymentProvider = provider;
  invoice.gatewayTransactionId = transactionId;
  await settleInvoice(invoice);

  await notify(invoice.owner, {
    type: NotificationType.INVOICE_PAID,
    title: `Hoá đơn ${invoice.code} đã thanh toán`,
    body: `${invoice.description} · ${invoice.amount.toLocaleString('vi-VN')}đ`,
    link: '/owner/billing',
  });
};

/**
 * Xử lý IPN của cổng thanh toán — trả về mã theo đúng bảng cổng yêu cầu, không ném lỗi (cổng
 * chỉ hiểu response JSON của nó, một exception ở đây chỉ khiến cổng retry vô ích).
 * Idempotent qua `PaymentTransaction`: `findOneAndUpdate` với điều kiện `status: 'pending'` đảm
 * bảo chỉ một trong nhiều lần gọi trùng thắng được chuyển trạng thái, IPN gọi lại sau đó luôn
 * gặp `status !== 'pending'` và trả 02 mà không cộng tiền lần hai.
 */
const handleGatewayIpn = async (providerName, query) => {
  const gateway = getProvider(providerName);

  if (!gateway.verifySignature(query)) {
    return { rspCode: '97', message: 'Invalid signature' };
  }

  const { txnRef, amount, transactionId } = gateway.parseCallback(query);
  const txn = await PaymentTransaction.findOne({ provider: gateway.name, providerTxnRef: txnRef });
  if (!txn) return { rspCode: '01', message: 'Order not found' };

  if (txn.status !== 'pending') {
    return { rspCode: '02', message: 'Order already confirmed' };
  }

  if (Math.round(amount) !== Math.round(txn.amount)) {
    await PaymentTransaction.updateOne({ _id: txn._id, status: 'pending' }, { status: 'failed', rawResponse: query });
    return { rspCode: '04', message: 'Invalid amount' };
  }

  if (!gateway.isSuccess(query)) {
    await PaymentTransaction.updateOne({ _id: txn._id, status: 'pending' }, { status: 'failed', rawResponse: query });
    return { rspCode: '00', message: 'Confirm Success' };
  }

  const claimed = await PaymentTransaction.findOneAndUpdate(
    { _id: txn._id, status: 'pending' },
    { status: 'success', rawResponse: query },
    { new: true }
  );
  if (!claimed) return { rspCode: '02', message: 'Order already confirmed' };

  await confirmInvoicePaymentViaGateway(txn.invoice, { provider: gateway.name, transactionId });

  return { rspCode: '00', message: 'Confirm Success' };
};

/** Return URL — chỉ để đưa người dùng về đúng chỗ, không dùng để xác nhận thanh toán (xem docs/02-kien-truc.md). */
const handleGatewayReturn = (providerName, query) => {
  const gateway = getProvider(providerName);
  const signatureValid = gateway.verifySignature(query);
  return { success: signatureValid && gateway.isSuccess(query) };
};

module.exports = { confirmInvoicePaymentViaGateway, handleGatewayIpn, handleGatewayReturn };
