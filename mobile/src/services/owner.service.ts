import type { Booking, Field, OwnerBooking, OwnerStats } from '@fcp/shared';
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
};
