import type { Booking } from '@fcp/shared';
import { authFetch } from '../lib/authFetch';
import { toQueryString } from './field.service';

export interface CreateBookingPayload {
  fieldId: string;
  subFieldId: string;
  date: string;
  startTime: string;
  endTime: string;
  teamId?: string;
  notes?: string;
  paymentMethod?: 'cash' | 'bank_transfer' | 'online';
}

export const bookingService = {
  create: (payload: CreateBookingPayload) =>
    authFetch<{ booking: Booking }>('/bookings', { method: 'POST', body: payload }),

  myBookings: (params: { page?: number; limit?: number; status?: string } = {}) =>
    authFetch<{ bookings: Booking[] }>(`/bookings/my-bookings${toQueryString(params)}`),

  getById: (id: string) => authFetch<{ booking: Booking }>(`/bookings/${id}`),

  /** `reason` là bắt buộc ở backend — huỷ không nêu lý do bị trả 400. */
  cancel: (id: string, reason: string) =>
    authFetch<{ booking: Booking }>(`/bookings/${id}/cancel`, {
      method: 'PATCH',
      body: { reason },
    }),
};
