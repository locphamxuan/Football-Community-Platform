import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MatchRequest } from '@fcp/shared';
import { Badge, Button, Card, EmptyState, ErrorState, Loading, TextField } from '../components/ui';
import ChipRow from '../components/ChipRow';
import RequireAuth from '../components/RequireAuth';
import { matchRequestService } from '../services/team.service';
import { messageOf } from '../lib/errors';
import { MATCH_STATUS_LABELS, formatSlot } from '../domain/format';
import { colors, fontSize, spacing, type StatusTone } from '../theme';

const STATUS_TONES: Record<string, StatusTone> = {
  pending: 'pending',
  accepted: 'active',
  completed: 'done',
  rejected: 'failed',
  cancelled: 'neutral',
};

const FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ phản hồi' },
  { value: 'accepted', label: 'Đã nhận lời' },
  { value: 'completed', label: 'Hoàn thành' },
];

function ScoreForm({
  request,
  onSubmit,
  submitting,
}: {
  request: MatchRequest;
  onSubmit: (scores: { requesterScore: number; opponentScore: number }) => void;
  submitting: boolean;
}) {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');

  const parsed = { requesterScore: Number(home), opponentScore: Number(away) };
  const valid =
    home !== '' && away !== '' &&
    Number.isInteger(parsed.requesterScore) && Number.isInteger(parsed.opponentScore) &&
    parsed.requesterScore >= 0 && parsed.opponentScore >= 0;

  return (
    <View style={styles.scoreBox}>
      <View style={styles.scoreRow}>
        <View style={styles.scoreCell}>
          <TextField
            label={request.requesterTeam?.name ?? 'Đội mời'}
            value={home}
            onChangeText={setHome}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>
        <View style={styles.scoreCell}>
          <TextField
            label={request.opponentTeam?.name ?? 'Đội được mời'}
            value={away}
            onChangeText={setAway}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>
      </View>
      <Button
        title="Gửi tỉ số"
        onPress={() => onSubmit(parsed)}
        disabled={!valid}
        loading={submitting}
      />
      <Text style={styles.hint}>Cả hai đội cùng nhập thì trận mới được tính Elo.</Text>
    </View>
  );
}

function RequestCard({
  request,
  onRespond,
  onCancel,
  onSubmitResult,
  busy,
}: {
  request: MatchRequest;
  onRespond: (accept: boolean) => void;
  onCancel: () => void;
  onSubmitResult: (scores: { requesterScore: number; opponentScore: number }) => void;
  busy: boolean;
}) {
  const [showScore, setShowScore] = useState(false);

  return (
    <Card>
      <View style={styles.cardHead}>
        <Text style={styles.matchup}>
          {request.requesterTeam?.name} vs {request.opponentTeam?.name}
        </Text>
        <Badge
          label={MATCH_STATUS_LABELS[request.status] ?? request.status}
          tone={STATUS_TONES[request.status] ?? 'neutral'}
        />
      </View>

      <Text style={styles.slot}>
        {formatSlot(request.date, request.startTime, request.endTime)} · {request.fieldSize}
      </Text>
      {!!request.message && <Text style={styles.message}>“{request.message}”</Text>}

      {request.status === 'completed' && request.result && (
        <Text style={styles.result}>
          Kết quả {request.result.requesterScore} – {request.result.opponentScore}
          {request.eloChange
            ? ` · Elo ${request.eloChange.requester > 0 ? '+' : ''}${request.eloChange.requester}`
            : ''}
        </Text>
      )}

      {request.status === 'pending' && (
        <View style={styles.actions}>
          <View style={styles.actionCell}>
            <Button title="Nhận lời" onPress={() => onRespond(true)} loading={busy} />
          </View>
          <View style={styles.actionCell}>
            <Button title="Từ chối" variant="outline" onPress={() => onRespond(false)} />
          </View>
          <View style={styles.actionCell}>
            <Button title="Huỷ lời mời" variant="outline" onPress={onCancel} />
          </View>
          <Text style={styles.hint}>
            Chỉ quản lý hoặc đội trưởng đội được mời mới trả lời được; chỉ người gửi mới huỷ được.
          </Text>
        </View>
      )}

      {request.status === 'accepted' && !showScore && (
        <View style={styles.actions}>
          <Button title="Nhập tỉ số" variant="outline" onPress={() => setShowScore(true)} />
        </View>
      )}

      {request.status === 'accepted' && showScore && (
        <ScoreForm request={request} onSubmit={onSubmitResult} submitting={busy} />
      )}
    </Card>
  );
}

function RequestList() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['match-requests', status],
    queryFn: () => matchRequestService.list({ status: status || undefined, limit: 50 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['match-requests'] });
  const fail = (err: unknown) => Alert.alert('Không thực hiện được', messageOf(err));

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      matchRequestService.respond(id, accept),
    onSuccess: invalidate,
    onError: fail,
    onSettled: () => setBusyId(null),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => matchRequestService.cancel(id),
    onSuccess: invalidate,
    onError: fail,
    onSettled: () => setBusyId(null),
  });

  const submitResult = useMutation({
    mutationFn: ({ id, scores }: { id: string; scores: { requesterScore: number; opponentScore: number } }) =>
      matchRequestService.submitResult(id, scores),
    onSuccess: invalidate,
    onError: fail,
    onSettled: () => setBusyId(null),
  });

  const requests = data?.requests ?? [];

  if (isLoading) return <Loading label="Đang tải lời mời" />;
  if (error) return <ErrorState message={messageOf(error)} onRetry={refetch} />;

  return (
    <View style={styles.flex}>
      <View style={styles.filters}>
        <ChipRow label="Lọc theo trạng thái" options={FILTERS} value={status} onChange={setStatus} />
      </View>

      {requests.length === 0 ? (
        <EmptyState
          title="Chưa có lời mời nào"
          hint="Lời mời thi đấu giữa các đội bạn tham gia sẽ hiện ở đây."
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(request) => request._id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              busy={busyId === item._id}
              onRespond={(accept) => {
                setBusyId(item._id);
                respond.mutate({ id: item._id, accept });
              }}
              onCancel={() => {
                setBusyId(item._id);
                cancel.mutate(item._id);
              }}
              onSubmitResult={(scores) => {
                setBusyId(item._id);
                submitResult.mutate({ id: item._id, scores });
              }}
            />
          )}
        />
      )}
    </View>
  );
}

export default function MatchRequestsScreen() {
  return (
    <RequireAuth message="Đăng nhập để xem lời mời thi đấu của đội bạn.">
      <RequestList />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  list: { padding: spacing.lg, paddingTop: 0 },
  cardHead: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  matchup: { color: colors.text, flexShrink: 1, fontSize: fontSize.md, fontWeight: '700' },
  slot: { color: colors.textMuted, marginTop: spacing.sm },
  message: { color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  result: { color: colors.primary, fontWeight: '700', marginTop: spacing.sm },
  actions: { marginTop: spacing.md },
  actionCell: { marginBottom: spacing.sm },
  hint: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: spacing.xs },
  scoreBox: { marginTop: spacing.md },
  scoreRow: { flexDirection: 'row', gap: spacing.md },
  scoreCell: { flex: 1 },
});
