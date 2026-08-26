const shared = require('./shared');
const owner = require('./owner');
const admin = require('./admin');
const gateway = require('./gateway');

module.exports = {
  ensureSubscription: shared.ensureSubscription,
  getOwnerUsage: shared.getOwnerUsage,
  monthRange: shared.monthRange,
  addMonths: shared.addMonths,
  getMySubscription: owner.getMySubscription,
  changePlan: owner.changePlan,
  setAutoRenew: owner.setAutoRenew,
  getMyInvoices: owner.getMyInvoices,
  reportPayment: owner.reportPayment,
  createCheckoutSession: owner.createCheckoutSession,
  assertCanCreateField: owner.assertCanCreateField,
  assertCanAddSubField: owner.assertCanAddSubField,
  getInvoices: admin.getInvoices,
  confirmInvoicePayment: admin.confirmInvoicePayment,
  voidInvoice: admin.voidInvoice,
  confirmInvoicePaymentViaGateway: gateway.confirmInvoicePaymentViaGateway,
  handleGatewayIpn: gateway.handleGatewayIpn,
  handleGatewayReturn: gateway.handleGatewayReturn,
};
