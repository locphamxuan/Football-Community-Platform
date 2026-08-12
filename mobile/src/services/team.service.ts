import type { MatchRequest, Team } from '@fcp/shared';
import { apiFetch } from '../lib/api';
import { authFetch } from '../lib/authFetch';
import { toQueryString, type QueryParams } from './field.service';

export interface TeamFilters extends QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  skillLevel?: string;
  fieldSize?: string;
}

export const teamService = {
  search: (filters: TeamFilters = {}) =>
    apiFetch<{ teams: Team[] }>(`/teams${toQueryString(filters)}`),

  getById: (id: string) => apiFetch<{ team: Team }>(`/teams/${id}`),

  myTeams: () => authFetch<{ teams: Team[] }>('/teams/me/my-teams'),

  /**
   * Tạo đội đi qua multipart vì backend nhận logo cùng lúc — app gửi FormData không
   * kèm ảnh vẫn hợp lệ, và mọi field tới backend đều là chuỗi (xem parseJsonFields).
   */
  create: (payload: {
    name: string;
    description?: string;
    homeCity?: string;
    skillLevel?: string;
    fieldSize?: string;
    isPublic?: boolean;
  }) =>
    authFetch<{ team: Team }>('/teams', {
      method: 'POST',
      form: Object.entries(payload).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value !== undefined && value !== '') acc[key] = String(value);
        return acc;
      }, {}),
    }),

  join: (id: string, inviteCode: string) =>
    authFetch<{ team: Team }>(`/teams/${id}/join`, { method: 'POST', body: { inviteCode } }),

  leave: (id: string) => authFetch<null>(`/teams/${id}/leave`, { method: 'POST' }),
};

export const matchRequestService = {
  list: (params: { status?: string; teamId?: string; limit?: number } = {}) =>
    authFetch<{ requests: MatchRequest[] }>(`/match-requests${toQueryString(params)}`),

  respond: (id: string, accept: boolean) =>
    authFetch<{ request: MatchRequest }>(`/match-requests/${id}/respond`, {
      method: 'PATCH',
      // Backend nhận boolean thật, chuỗi 'true' bị trả 400.
      body: { accept },
    }),

  cancel: (id: string) =>
    authFetch<{ request: MatchRequest }>(`/match-requests/${id}/cancel`, { method: 'PATCH' }),

  submitResult: (id: string, scores: { requesterScore: number; opponentScore: number }) =>
    authFetch<{ request: MatchRequest }>(`/match-requests/${id}/result`, {
      method: 'PATCH',
      body: scores,
    }),

  create: (payload: {
    requesterTeamId: string;
    opponentTeamId: string;
    date: string;
    startTime: string;
    endTime: string;
    fieldSize: string;
    message?: string;
  }) => authFetch<{ request: MatchRequest }>('/match-requests', { method: 'POST', body: payload }),
};
