import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { Team } from '@fcp/shared';
import { Badge, Button, EmptyState, ErrorState, Loading } from '../components/ui';
import ChipRow from '../components/ChipRow';
import { useAuth } from '../lib/auth';
import { teamService } from '../services/team.service';
import { messageOf } from '../lib/errors';
import { SKILL_LEVEL_LABELS } from '../domain/format';
import { colors, fontSize, radius, spacing } from '../theme';

const TABS = [
  { value: 'discover', label: 'Khám phá' },
  { value: 'mine', label: 'Đội của tôi' },
];

function TeamRow({ team }: { team: Team }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/teams/${team._id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHead}>
        <Text style={styles.name}>{team.name}</Text>
        <Badge label={`Elo ${team.stats?.eloRating ?? 1200}`} tone="active" />
      </View>
      <Text style={styles.meta}>
        {[team.homeCity, SKILL_LEVEL_LABELS[team.skillLevel] ?? team.skillLevel, team.fieldSize]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Text style={styles.meta}>
        {team.members?.length ?? 0}/{team.maxMembers} thành viên
      </Text>
    </Pressable>
  );
}

export default function TeamsScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState('discover');

  const discover = useQuery({
    queryKey: ['teams', 'discover'],
    queryFn: () => teamService.search({ limit: 30 }),
    enabled: tab === 'discover',
  });

  const mine = useQuery({
    queryKey: ['teams', 'mine'],
    queryFn: () => teamService.myTeams(),
    enabled: tab === 'mine' && !!user,
  });

  const active = tab === 'mine' ? mine : discover;
  const teams = tab === 'mine' ? mine.data?.teams ?? [] : discover.data?.teams ?? [];
  const needsLogin = tab === 'mine' && !user;

  return (
    <>
      <View style={styles.header}>
        <ChipRow label="" options={TABS} value={tab} onChange={setTab} />
        {!!user && (
          <View style={styles.headerActions}>
            <Button
              title="Tạo đội mới"
              variant="outline"
              onPress={() => router.push('/teams/create')}
            />
            <View style={styles.spacer} />
            <Button
              title="Lời mời thi đấu"
              variant="outline"
              onPress={() => router.push('/match-requests')}
            />
          </View>
        )}
      </View>

      {needsLogin ? (
        <EmptyState title="Cần đăng nhập" hint="Đăng nhập để xem các đội bạn đang tham gia." />
      ) : active.isLoading ? (
        <Loading label="Đang tải đội bóng" />
      ) : active.error ? (
        <ErrorState message={messageOf(active.error)} onRetry={active.refetch} />
      ) : teams.length === 0 ? (
        <EmptyState
          title={tab === 'mine' ? 'Bạn chưa ở đội nào' : 'Chưa có đội nào'}
          hint={tab === 'mine' ? 'Tạo đội mới hoặc xin mã mời từ bạn bè.' : undefined}
        />
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(team) => team._id}
          renderItem={({ item }) => <TeamRow team={item} />}
          contentContainerStyle={styles.list}
          onRefresh={active.refetch}
          refreshing={active.isRefetching}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  headerActions: { flexDirection: 'row', marginBottom: spacing.md },
  spacer: { width: spacing.md },
  list: { padding: spacing.lg, paddingTop: 0 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  cardPressed: { opacity: 0.7 },
  cardHead: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  name: { color: colors.text, flexShrink: 1, fontSize: fontSize.lg, fontWeight: '700' },
  meta: { color: colors.textMuted, marginTop: spacing.xs },
});
