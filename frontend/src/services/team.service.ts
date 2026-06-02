import api from './api';
import type { ApiResponse, Team, PaginationMeta } from '@/types';

export interface TeamFilters {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  skillLevel?: string;
  fieldSize?: string;
  sort?: string;
}

const teamService = {
  getTeams: (params?: TeamFilters) =>
    api.get<ApiResponse<{ teams: Team[] }>>('/teams', { params }),

  getTeamById: (id: string) =>
    api.get<ApiResponse<{ team: Team }>>(`/teams/${id}`),

  getMyTeams: () =>
    api.get<ApiResponse<{ teams: Team[] }>>('/teams/me/my-teams'),

  createTeam: (data: FormData) =>
    api.post<ApiResponse<{ team: Team }>>('/teams', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateTeam: (id: string, data: FormData) =>
    api.patch<ApiResponse<{ team: Team }>>(`/teams/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteTeam: (id: string) =>
    api.delete<ApiResponse<null>>(`/teams/${id}`),

  joinTeam: (id: string, inviteCode: string) =>
    api.post<ApiResponse<{ team: Team }>>(`/teams/${id}/join`, { inviteCode }),

  leaveTeam: (id: string) =>
    api.post<ApiResponse<null>>(`/teams/${id}/leave`),

  removeMember: (teamId: string, memberId: string) =>
    api.delete<ApiResponse<{ team: Team }>>(`/teams/${teamId}/members/${memberId}`),

  updateMember: (teamId: string, memberId: string, data: { role?: string; position?: string; status?: string }) =>
    api.patch<ApiResponse<{ team: Team }>>(`/teams/${teamId}/members/${memberId}`, data),

  regenerateInviteCode: (teamId: string) =>
    api.post<ApiResponse<{ inviteCode: string }>>(`/teams/${teamId}/invite-code/regenerate`),
};

export default teamService;
