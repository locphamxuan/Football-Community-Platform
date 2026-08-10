import api from './api';
import type {
  ApiResponse, Field, Invoice, InvoiceStatus, OwnerDetail, OwnerSummary,
  PlanCode, PlatformOverview, PlatformRevenuePoint, Role, User,
} from '@/types';

export interface OwnerFilters {
  page?: number;
  limit?: number;
  search?: string;
  plan?: PlanCode;
}

export interface AdminUserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  status?: User['status'];
}

export interface AdminFieldFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: Field['status'];
  verified?: 'true' | 'false';
}

const adminService = {
  getOverview: () => api.get<ApiResponse<{ overview: PlatformOverview }>>('/admin/overview'),

  getRevenueSeries: (months = 12) =>
    api.get<ApiResponse<{ series: PlatformRevenuePoint[] }>>('/admin/revenue', { params: { months } }),

  getOwners: (params?: OwnerFilters) =>
    api.get<ApiResponse<{ owners: OwnerSummary[] }>>('/admin/owners', { params }),

  getOwnerDetail: (id: string) => api.get<ApiResponse<OwnerDetail>>(`/admin/owners/${id}`),

  getUsers: (params?: AdminUserFilters) =>
    api.get<ApiResponse<{ users: User[] }>>('/admin/users', { params }),

  updateUser: (id: string, data: { status?: User['status']; roles?: Role[] }) =>
    api.patch<ApiResponse<{ user: User }>>(`/admin/users/${id}`, data),

  getFields: (params?: AdminFieldFilters) =>
    api.get<ApiResponse<{ fields: Field[] }>>('/admin/fields', { params }),

  getInvoices: (params?: { page?: number; limit?: number; status?: InvoiceStatus; ownerId?: string }) =>
    api.get<ApiResponse<{ invoices: Invoice[] }>>('/admin/invoices', { params }),

  confirmInvoice: (id: string) =>
    api.patch<ApiResponse<{ invoice: Invoice }>>(`/admin/invoices/${id}/confirm`),

  voidInvoice: (id: string, reason?: string) =>
    api.patch<ApiResponse<{ invoice: Invoice }>>(`/admin/invoices/${id}/void`, { reason }),
};

export default adminService;
