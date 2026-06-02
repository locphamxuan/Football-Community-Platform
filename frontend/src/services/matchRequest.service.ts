import api from './api';
import type { ApiResponse, MatchRequest } from '@/types';

export interface MatchRequestFilters {
  page?: number;
  limit?: number;
  status?: string;
  teamId?: string;
}

const matchRequestService = {
  create: (data: {
    requesterTeamId: string;
    opponentTeamId: string;
    date: string;
    startTime: string;
    endTime: string;
    fieldSize: string;
    fieldId?: string;
    message?: string;
  }) => api.post<ApiResponse<{ request: MatchRequest }>>('/match-requests', data),

  getAll: (params?: MatchRequestFilters) =>
    api.get<ApiResponse<{ requests: MatchRequest[] }>>('/match-requests', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<{ request: MatchRequest }>>(`/match-requests/${id}`),

  respond: (id: string, accept: boolean) =>
    api.patch<ApiResponse<{ request: MatchRequest }>>(`/match-requests/${id}/respond`, { accept }),

  cancel: (id: string) =>
    api.patch<ApiResponse<{ request: MatchRequest }>>(`/match-requests/${id}/cancel`),

  submitResult: (id: string, data: { requesterScore: number; opponentScore: number }) =>
    api.patch<ApiResponse<{ request: MatchRequest }>>(`/match-requests/${id}/result`, data),
};

export default matchRequestService;
