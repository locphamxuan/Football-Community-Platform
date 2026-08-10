import api from './api';
import type {
  ApiResponse, Invoice, InvoiceStatus, Plan, PlanCode, Subscription, SubscriptionOverview,
} from '@/types';

export interface InvoiceFilters {
  page?: number;
  limit?: number;
  status?: InvoiceStatus;
}

/** Thuê bao nền tảng của chủ sân — tiền chủ sân trả cho hệ thống, tách khỏi tiền đặt sân. */
const billingService = {
  getPlans: () => api.get<ApiResponse<{ plans: Plan[] }>>('/billing/plans'),

  getSubscription: () => api.get<ApiResponse<SubscriptionOverview>>('/billing/subscription'),

  changePlan: (plan: PlanCode) =>
    api.patch<ApiResponse<{ subscription: Subscription; plan: Plan; invoice: Invoice | null }>>(
      '/billing/subscription/plan',
      { plan }
    ),

  setAutoRenew: (autoRenew: boolean) =>
    api.patch<ApiResponse<{ subscription: Subscription }>>('/billing/subscription/auto-renew', { autoRenew }),

  getInvoices: (params?: InvoiceFilters) =>
    api.get<ApiResponse<{ invoices: Invoice[] }>>('/billing/invoices', { params }),

  reportPayment: (invoiceId: string, paymentReference: string) =>
    api.post<ApiResponse<{ invoice: Invoice }>>(`/billing/invoices/${invoiceId}/report-payment`, {
      paymentReference,
    }),
};

export default billingService;
