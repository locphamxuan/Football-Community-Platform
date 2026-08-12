import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  DetailRow,
  ErrorState,
  Loading,
  Screen,
  TextField,
} from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { teamService } from '../../src/services/team.service';
import { messageOf } from '../../src/lib/errors';
import { SKILL_LEVEL_LABELS } from '../../src/lib/format';
import { colors, fontSize, spacing } from '../../src/lib/theme';

const MEMBER_ROLE_LABELS: Record<string, string> = {
  manager: 'Quản lý',
  captain: 'Đội trưởng',
  player: 'Cầu thủ',
};

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['team', id],
    queryFn: () => teamService.getById(id),
    enabled: !!id,
  });

  const join = useMutation({
    mutationFn: () => teamService.join(id, inviteCode.trim()),
    onSuccess: () => {
      setInviteCode('');
      queryClient.invalidateQueries({ queryKey: ['team', id] });
      queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });
      Alert.alert('Đã tham gia đội', 'Bạn giờ là thành viên của đội này.');
    },
    onError: (err) => Alert.alert('Không tham gia được', messageOf(err)),
  });

  const leave = useMutation({
    mutationFn: () => teamService.leave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] });
      router.back();
    },
    onError: (err) => Alert.alert('Không rời đội được', messageOf(err)),
  });

  if (isLoading) return <Screen><Loading label="Đang tải đội bóng" /></Screen>;
  if (error || !data) {
    return <Screen><ErrorState message={messageOf(error)} onRetry={refetch} /></Screen>;
  }

  const { team } = data;
  const isMember = team.members?.some((member) => member.user?.id === user?.id);
  const isManager = team.manager?.id === user?.id;
  const stats = team.stats;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.name}>{team.name}</Text>
        <View style={styles.badges}>
          <Badge label={`Elo ${stats?.eloRating ?? 1200}`} tone="active" />
          <Badge label={SKILL_LEVEL_LABELS[team.skillLevel] ?? team.skillLevel} />
          <Badge label={team.fieldSize} />
        </View>
        {!!team.description && <Text style={styles.description}>{team.description}</Text>}

        <Card>
          <Text style={styles.sectionTitle}>Thành tích</Text>
          <DetailRow label="Số trận" value={String(stats?.matchesPlayed ?? 0)} />
          <DetailRow
            label="Thắng / Hoà / Thua"
            value={`${stats?.wins ?? 0} / ${stats?.draws ?? 0} / ${stats?.losses ?? 0}`}
          />
          <DetailRow
            label="Bàn thắng / thủng lưới"
            value={`${stats?.goalsScored ?? 0} / ${stats?.goalsConceded ?? 0}`}
          />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>
            Thành viên ({team.members?.length ?? 0}/{team.maxMembers})
          </Text>
          {(team.members ?? []).map((member) => (
            <DetailRow
              key={member.user?.id ?? member.joinedAt}
              label={member.user?.fullName ?? member.user?.username ?? 'Thành viên'}
              value={MEMBER_ROLE_LABELS[member.role] ?? member.role}
            />
          ))}
        </Card>

        {isManager && !!team.inviteCode && (
          <Card>
            <Text style={styles.sectionTitle}>Mã mời</Text>
            <Text style={styles.inviteCode}>{team.inviteCode}</Text>
            <Text style={styles.hint}>Gửi mã này cho người bạn muốn thêm vào đội.</Text>
          </Card>
        )}

        {!!user && !isMember && (
          <Card>
            <Text style={styles.sectionTitle}>Tham gia đội</Text>
            <TextField
              label="Mã mời"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              placeholder="Nhập mã quản lý đội gửi cho bạn"
            />
            <Button
              title="Tham gia"
              onPress={() => join.mutate()}
              disabled={!inviteCode.trim()}
              loading={join.isPending}
            />
          </Card>
        )}

        {isMember && !isManager && (
          <Button title="Rời đội" variant="danger" onPress={() => leave.mutate()} loading={leave.isPending} />
        )}
        {isManager && (
          <Text style={styles.hint}>
            Quản lý phải chuyển quyền cho người khác trước khi rời đội — làm việc này trên web.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  name: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.md },
  description: { color: colors.textMuted, marginBottom: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.sm },
  inviteCode: { color: colors.primary, fontSize: fontSize.xl, fontWeight: '700', letterSpacing: 2 },
  hint: { color: colors.textSubtle, fontSize: fontSize.sm, marginTop: spacing.sm },
});
