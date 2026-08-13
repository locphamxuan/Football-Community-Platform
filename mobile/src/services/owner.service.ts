import type {
  Booking, Field, Invoice, OwnerBooking, OwnerReview, OwnerStats, Review, SubscriptionOverview,
} from '@fcp/shared';
import { authFetch } from '../lib/authFetch';
import { toQueryString, type QueryParams } from './field.service';

export interface OwnerBookingFilters extends QueryParams {
  page?: number;
  limit?: number;
  fieldId?: string;
  status?: Booking['status'];
}

export const ownerService = {
  stats: () => authFetch<{ stats: OwnerStats }>('/bookings/owner/stats'),

  /** Lịch đặt trên mọi sân của chủ sân đang đăng nhập. */
  bookings: (filters: OwnerBookingFilters = {}) =>
    authFetch<{ bookings: OwnerBooking[] }>(`/bookings/owner/bookings${toQueryString(filters)}`),

  myFields: () => authFetch<{ fields: Field[] }>('/fields/owner/my-fields'),

  confirmBooking: (id: string) =>
    authFetch<{ booking: Booking }>(`/bookings/${id}/confirm`, { method: 'PATCH' }),

  completeBooking: (id: string) =>
    authFetch<{ booking: Booking }>(`/bookings/${id}/complete`, { method: 'PATCH' }),

  markNoShow: (id: string) =>
    authFetch<{ booking: Booking }>(`/bookings/${id}/no-show`, { method: 'PATCH' }),

  /**
   * Bật/tắt nhận đặt sân. Đi qua multipart vì endpoint sửa sân nhận kèm ảnh, nên mọi
   * field tới backend đều là chuỗi (xem `booleanish` trong field.validation.js).
   */
  setFieldStatus: (id: string, status: Field['status']) =>
    authFetch<{ field: Field }>(`/fields/${id}`, { method: 'PATCH', form: { status } }),

  /** Đánh giá trên mọi sân của chủ sân, kèm số chưa trả lời để hiện lên tab. */
  reviews: (filters: { unanswered?: boolean; limit?: number } = {}) =>
    authFetch<{ reviews: OwnerReview[]; unanswered: number }>(
      `/reviews/owner/reviews${toQueryString({
        ...(filters.unanswered ? { unanswered: 'true' } : {}),
        ...(filters.limit ? { limit: filters.limit } : {}),
      })}`
    ),

  replyToReview: (id: string, comment: string) =>
    authFetch<{ review: Review }>(`/reviews/${id}/reply`, { method: 'POST', body: { comment } }),

  subscription: () => authFetch<SubscriptionOverview>('/billing/subscription'),

  invoices: (params: { limit?: number } = {}) =>
    authFetch<{ invoices: Invoice[] }>(`/billing/invoices${toQueryString(params)}`),

  setAutoRenew: (autoRenew: boolean) =>
    authFetch<{ subscription: SubscriptionOverview['subscription'] }>(
      '/billing/subscription/auto-renew',
      { method: 'PATCH', body: { autoRenew } }
    ),

  /**
   * Chủ sân tự khai mã giao dịch sau khi chuyển khoản; admin đối soát rồi mới đổi hoá đơn
   * sang `paid`. Chưa có cổng thanh toán nên đây vẫn là đường duy nhất.
   */
  reportPayment: (invoiceId: string, paymentReference: string) =>
    authFetch<{ invoice: Invoice }>(`/billing/invoices/${invoiceId}/report-payment`, {
      method: 'POST',
      body: { paymentReference },
    }),
};
