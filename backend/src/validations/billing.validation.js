const { z } = require('zod');
const { PLAN_CODES, InvoiceStatus } = require('../constants/plans');

const changePlanSchema = z.object({
  plan: z.enum(PLAN_CODES),
});

const autoRenewSchema = z.object({
  autoRenew: z.boolean(),
});

const reportPaymentSchema = z.object({
  paymentReference: z.string().min(3, 'Payment reference required').max(100),
});

const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(Object.values(InvoiceStatus)).optional(),
  ownerId: z.string().min(1).optional(),
});

const voidInvoiceSchema = z.object({
  reason: z.string().max(300).optional(),
});

const checkoutSchema = z.object({
  provider: z.enum(['vnpay', 'momo']).optional().default('vnpay'),
});

module.exports = {
  changePlanSchema,
  autoRenewSchema,
  reportPaymentSchema,
  invoiceQuerySchema,
  voidInvoiceSchema,
  checkoutSchema,
};
