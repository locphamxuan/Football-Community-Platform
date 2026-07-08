'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import teamService, { TeamFilters } from '@/services/team.service';
import { SKILL_LEVEL_LABELS, SKILL_LEVEL_COLORS, FIELD_TYPES } from '@/lib/constants';
import type { Team } from '@/types';
import { Search, Users, Trophy, Swords, Plus } from 'lucide-react';
import useAuthStore from '@/stores/authStore';

export default function TeamsPage() {
  const { isAuthenticated } = useAuthStore();
  const [filters, setFilters] = useState<TeamFilters>({ page: 1, limit: 12, sort: 'elo' });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['teams', filters],
    queryFn: () => teamService.getTeams(filters),
  });

  const teams: Team[] = data?.data?.data?.teams ?? [];
  const pagination = data?.data?.meta?.pagination;

  const handleSearch = () => setFilters((f) => ({ ...f, search: searchInput, page: 1 }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tìm đội bóng</h1>
          <p className="text-muted-foreground mt-1">Kết nối và thách đấu các đội bóng phong trào</p>
        </div>
        {isAuthenticated && (
          <Link href="/teams/create">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />Tạo đội
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tên đội..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} className="bg-primary hover:bg-primary/90">Tìm</Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Thành phố"
            className="w-36 h-8 text-sm"
            value={filters.city ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value || undefined, page: 1 }))}
          />

          <Select value={filters.skillLevel ?? ''} onValueChange={(v) => setFilters((f) => ({ ...f, skillLevel: v || undefined, page: 1 }))}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Trình độ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trình độ</SelectItem>
              {Object.entries(SKILL_LEVEL_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.fieldSize ?? ''} onValueChange={(v) => setFilters((f) => ({ ...f, fieldSize: v || undefined, page: 1 }))}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Loại sân" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.sort} onValueChange={(v) => v && setFilters((f) => ({ ...f, sort: v }))}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="elo">ELO cao nhất</SelectItem>
              <SelectItem value="matches">Nhiều trận nhất</SelectItem>
              <SelectItem value="newest">Mới nhất</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Không tìm thấy đội bóng</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {teams.map((team) => <TeamCard key={team._id} team={team} />)}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          <Button variant="outline" disabled={!pagination.hasPrevPage} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}>Trước</Button>
          <span className="flex items-center px-4 text-sm">Trang {pagination.page} / {pagination.totalPages}</span>
          <Button variant="outline" disabled={!pagination.hasNextPage} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}>Sau</Button>
        </div>
      )}
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const winRate = team.stats.matchesPlayed > 0
    ? Math.round((team.stats.wins / team.stats.matchesPlayed) * 100)
    : 0;

  return (
    <Link href={`/teams/${team._id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-14 w-14 border-2 border-primary/20">
              <AvatarImage src={team.logo} alt={team.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                {team.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{team.name}</h3>
              <p className="text-sm text-muted-foreground">{team.homeCity || 'Chưa cập nhật'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            <Badge variant="outline" className={`text-xs ${SKILL_LEVEL_COLORS[team.skillLevel]}`}>
              {SKILL_LEVEL_LABELS[team.skillLevel]}
            </Badge>
            <Badge variant="outline" className="text-xs">{team.fieldSize}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center border-t pt-3">
            <div>
              <div className="flex items-center justify-center gap-1 text-amber-600 font-bold">
                <Trophy className="h-3 w-3" />
                <span className="text-sm">{team.stats.eloRating}</span>
              </div>
              <p className="text-xs text-muted-foreground">ELO</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-blue-600 font-bold">
                <Swords className="h-3 w-3" />
                <span className="text-sm">{team.stats.matchesPlayed}</span>
              </div>
              <p className="text-xs text-muted-foreground">Trận</p>
            </div>
            <div>
              <div className="font-bold text-sm text-primary">{winRate}%</div>
              <p className="text-xs text-muted-foreground">Tỷ thắng</p>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-3 text-sm text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{team.members.filter((m) => m.status === 'active').length}/{team.maxMembers} thành viên</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
