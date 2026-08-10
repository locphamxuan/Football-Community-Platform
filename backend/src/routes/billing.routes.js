const { Router } = require('express');
const controller = require('../controllers/billing.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const Role = require('../constants/roles');
const {
  changePlanSchema, autoRenewSchema, reportPaymentSchema, invoiceQuerySchema,
} = require('../validations/billing.validation');

const router = Router();

// Bảng giá công khai để trang giới thiệu hiển thị được
router.get('/plans', controller.getPlans);

router.use(authenticate, authorize(Role.FIELD_OWNER, Role.ADMIN));

router.get('/subscription', controller.getMySubscription);
router.patch('/subscription/plan', validate(changePlanSchema), controller.changePlan);
router.patch('/subscription/auto-renew', validate(autoRenewSchema), controller.setAutoRenew);

router.get('/invoices', validate(invoiceQuerySchema, 'query'), controller.getMyInvoices);
router.post('/invoices/:id/report-payment', validate(reportPaymentSchema), controller.reportPayment);

module.exports = router;
