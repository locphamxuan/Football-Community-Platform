import api from './api';
import type {
  ApiResponse, Booking, OwnerBooking, OwnerRevenuePoint, OwnerStats, TeamBooking,
} from '@/types';

export interface OwnerBookingFilters {
  page?: number;
  limit?: number;
  fieldId?: string;
  status?: Booking['status'];
  startDate?: string;
  endDate?: string;
}

export interface TeamBookingFilters {
  page?: number;
  limit?: number;
  teamId?: string;
  status?: Booking['status'];
  startDate?: string;
  endDate?: string;
}

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

  /** Lịch sân của các đội mà user đang dẫn dắt. */
  getTeamBookings: (params?: TeamBookingFilters) =>
    api.get<ApiResponse<{ bookings: TeamBooking[] }>>('/bookings/team/bookings', { params }),

  getFieldBookings: (fieldId: string, params?: Record<string, unknown>) =>
    api.get<ApiResponse<{ bookings: Booking[] }>>(`/bookings/field/${fieldId}`, { params }),

  /** Lịch đặt trên mọi sân của chủ sân đang đăng nhập. */
  getOwnerBookings: (params?: OwnerBookingFilters) =>
    api.get<ApiResponse<{ bookings: OwnerBooking[] }>>('/bookings/owner/bookings', { params }),

  getOwnerStats: () =>
    api.get<ApiResponse<{ stats: OwnerStats }>>('/bookings/owner/stats'),

  /** Doanh thu và lượt đặt theo tháng, dùng cho biểu đồ dashboard chủ sân. */
  getOwnerRevenue: (months = 6) =>
    api.get<ApiResponse<{ series: OwnerRevenuePoint[] }>>('/bookings/owner/revenue', { params: { months } }),

  cancelBooking: (id: string, reason: string) =>
    api.patch<ApiResponse<{ booking: Booking }>>(`/bookings/${id}/cancel`, { reason }),

  confirmBooking: (id: string) =>
    api.patch<ApiResponse<{ booking: Booking }>>(`/bookings/${id}/confirm`),

  completeBooking: (id: string) =>
    api.patch<ApiResponse<{ booking: Booking }>>(`/bookings/${id}/complete`),

  markNoShow: (id: string) =>
    api.patch<ApiResponse<{ booking: Booking }>>(`/bookings/${id}/no-show`),
};

export default bookingService;
