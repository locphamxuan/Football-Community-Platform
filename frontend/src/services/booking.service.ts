import api from './api';
import type { ApiResponse, Booking } from '@/types';

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

const bookingService = {
  createBooking: (data: CreateBookingPayload) =>
    api.post<ApiResponse<{ booking: Booking }>>('/bookings', data),

  getBookingById: (id: string) =>
    api.get<ApiResponse<{ booking: Booking }>>(`/bookings/${id}`),

  getMyBookings: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<{ bookings: Booking[] }>>('/bookings/my-bookings', { params }),

  getFieldBookings: (fieldId: string, params?: Record<string, unknown>) =>
    api.get<ApiResponse<{ bookings: Booking[] }>>(`/bookings/field/${fieldId}`, { params }),

  cancelBooking: (id: string, reason: string) =>
    api.patch<ApiResponse<{ booking: Booking }>>(`/bookings/${id}/cancel`, { reason }),

  confirmBooking: (id: string) =>
    api.patch<ApiResponse<{ booking: Booking }>>(`/bookings/${id}/confirm`),

  completeBooking: (id: string) =>
    api.patch<ApiResponse<{ booking: Booking }>>(`/bookings/${id}/complete`),
};

export default bookingService;
