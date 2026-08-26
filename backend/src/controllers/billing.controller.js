const billingService = require('../services/billing');
const { sendSuccess, paginationMeta } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');
const { PLANS } = require('../constants/plans');

const getPlans = catchAsync(async (_req, res) => {
  sendSuccess(res, { plans: Object.values(PLANS) });
});

const getMySubscription = catchAsync(async (req, res) => {
  const data = await billingService.getMySubscription(req.user.id);
  sendSuccess(res, data);
});

const changePlan = catchAsync(async (req, res) => {
  const result = await billingService.changePlan(req.user.id, req.body.plan);
  sendSuccess(res, result, 'Subscription plan updated');
});

const setAutoRenew = catchAsync(async (req, res) => {
  const subscription = await billingService.setAutoRenew(req.user.id, req.body.autoRenew);
  sendSuccess(res, { subscription }, 'Auto-renew updated');
});

const getMyInvoices = catchAsync(async (req, res) => {
  const { invoices, total, page, limit } = await billingService.getMyInvoices(req.user.id, req.query);
  sendSuccess(res, { invoices }, 'Invoices retrieved', HttpStatus.OK, {
    pagination: paginationMeta(total, page, limit),
  });
});

const reportPayment = catchAsync(async (req, res) => {
  const invoice = await billingService.reportPayment(req.user.id, req.params.id, req.body.paymentReference);
  sendSuccess(res, { invoice }, 'Payment reported, awaiting confirmation');
});

const checkout = catchAsync(async (req, res) => {
  const result = await billingService.createCheckoutSession(req.user.id, req.params.id, req.body.provider, req.ip);
  sendSuccess(res, result);
});

module.exports = {
  getPlans, getMySubscription, changePlan, setAutoRenew, getMyInvoices, reportPayment, checkout,
};
