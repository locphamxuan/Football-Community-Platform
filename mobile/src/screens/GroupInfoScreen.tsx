import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ChatParticipantProfile } from '@fcp/shared';
import { Avatar, Button, ErrorState, Loading, TextField } from '../components/ui';
import RequireAuth from '../components/RequireAuth';
import UserSearch from '../components/UserSearch';
import { chatService } from '../services/chat.service';
import { chatKeys } from '../lib/chatSocket';
import { isGroupAdmin } from '../lib/chat';
import { useAuth } from '../lib/auth';
import { messageOf } from '../lib/errors';
import { colors, fontSize, radius, spacing } from '../lib/theme';

/**
 * Thông tin nhóm: thành viên, đổi tên, thêm, gỡ, rời nhóm.
 *
 * Thành viên thường vẫn mở được để biết nhóm gồm những ai — họ chỉ không thấy các nút sửa,
 * đúng những thao tác mà backend cũng sẽ từ chối.
 */
function GroupInfo({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null);
  const [toAdd, setToAdd] = useState<ChatParticipantProfile[]>([]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => chatService.conversation(conversationId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) });
    queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
  };

  const fail = (title: string) => (err: unknown) => Alert.alert(title, messageOf(err));

  const rename = useMutation({
    mutationFn: (next: string) => chatService.renameGroup(conversationId, next),
    onSuccess: refresh,
    onError: fail('Không đổi được tên nhóm'),
  });

  const addMembers = useMutation({
    mutationFn: (memberIds: string[]) => chatService.addMembers(conversationId, memberIds),
    onSuccess: () => {
      setToAdd([]);
      refresh();
    },
    onError: fail('Không thêm được thành viên'),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => chatService.removeMember(conversationId, memberId),
    onSuccess: refresh,
    onError: fail('Không gỡ được thành viên'),
  });

  const leave = useMutation({
    mutationFn: () => chatService.leaveGroup(conversationId),
    onSuccess: () => {
      refresh();
      // Nhóm không còn là của mình; ở lại chỉ để mọi thao tác nhận 403.
      router.replace('/(tabs)/chat');
    },
    onError: fail('Không rời được nhóm'),
  });

  if (isLoading) return <Loading label="Đang tải thông tin nhóm" />;
  if (error) return <ErrorState message={messageOf(error)} onRetry={refetch} />;

  const conversation = data!.conversation;
  const canManage = isGroupAdmin(conversation, user?.id);
  const currentName = name ?? conversation.name;
  const memberIds = conversation.participants.map((p) => p.user._id);

  const confirmLeave = () =>
    Alert.alert('Rời nhóm', `Bạn sẽ không nhận tin nhắn của "${conversation.name}" nữa.`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Rời nhóm', style: 'destructive', onPress: () => leave.mutate() },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{conversation.participants.length} thành viên</Text>

      {canManage && (
        <View style={styles.section}>
          <TextField label="Tên nhóm" value={currentName} onChangeText={setName} maxLength={100} />
          <Button
            title="Lưu tên nhóm"
            variant="outline"
            onPress={() => rename.mutate(currentName.trim())}
            disabled={!currentName.trim() || currentName.trim() === conversation.name}
            loading={rename.isPending}
          />
        </View>
      )}

      <View style={styles.section}>
        {conversation.participants.map(({ user: member, role }) => (
          <View key={member._id} style={styles.row}>
            <Avatar name={member.fullName} size={32} />
            <View style={styles.rowBody}>
              <Text style={styles.name} numberOfLines={1}>
                {member.fullName}{member._id === user?.id ? ' (bạn)' : ''}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {role === 'admin' ? 'Quản trị nhóm' : `@${member.username}`}
              </Text>
            </View>
            {canManage && member._id !== user?.id && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Gỡ ${member.fullName} khỏi nhóm`}
                onPress={() => removeMember.mutate(member._id)}
                style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
              >
                <Text style={styles.removeText}>Gỡ</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {canManage && (
        <View style={styles.picker}>
          <UserSearch
            selected={toAdd}
            onToggle={(person) =>
              setToAdd((current) =>
                current.some((u) => u._id === person._id)
                  ? current.filter((u) => u._id !== person._id)
                  : [...current, person]
              )
            }
            excludeIds={memberIds}
            label="Thêm thành viên"
          />
          <Button
            title="Thêm vào nhóm"
            onPress={() => addMembers.mutate(toAdd.map((u) => u._id))}
            disabled={!toAdd.length}
            loading={addMembers.isPending}
          />
        </View>
      )}

      <View style={styles.section}>
        <Button title="Rời nhóm" variant="danger" onPress={confirmLeave} loading={leave.isPending} />
      </View>
    </ScrollView>
  );
}

export default function GroupInfoScreen({ conversationId }: { conversationId: string }) {
  return (
    <RequireAuth message="Đăng nhập để xem thông tin nhóm.">
      <GroupInfo conversationId={conversationId} />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  heading: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md },
  section: { marginBottom: spacing.xl },
  // Ô tìm người có FlatList bên trong: cho nó chiều cao cố định thay vì để nó cuộn
  // lồng trong ScrollView, nơi nó sẽ không cuộn được.
  picker: { height: 320, marginBottom: spacing.xl },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  rowBody: { flex: 1 },
  name: { color: colors.text, fontSize: fontSize.md },
  meta: { color: colors.textMuted, fontSize: fontSize.xs },
  remove: {
    borderColor: colors.danger,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  removeText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
