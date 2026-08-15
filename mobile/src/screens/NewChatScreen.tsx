import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ChatParticipantProfile } from '@fcp/shared';
import { Button, TextField } from '../components/ui';
import RequireAuth from '../components/RequireAuth';
import UserSearch from '../components/UserSearch';
import { chatService } from '../services/chat.service';
import { chatKeys } from '../lib/chatSocket';
import { messageOf } from '../lib/errors';
import { spacing } from '../lib/theme';

/**
 * Bắt đầu một cuộc trò chuyện: nhắn thẳng cho một người, hoặc lập một nhóm.
 *
 * Một màn hình cho cả hai vì chúng chỉ khác nhau ở "chọn một" hay "chọn nhiều người và đặt
 * tên" — tách đôi thì hai bản sao của cùng một ô tìm người sẽ trôi khỏi nhau.
 */
function NewChat({ mode }: { mode: 'direct' | 'group' }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ChatParticipantProfile[]>([]);
  const [name, setName] = useState('');

  const isGroup = mode === 'group';

  const openConversation = (id: string) => {
    queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    // `replace` chứ không `push`: bấm back từ khung chat phải về hộp thư, không quay lại
    // màn hình chọn người vừa dùng xong.
    router.replace(`/chat/${id}`);
  };

  const create = useMutation({
    mutationFn: () =>
      isGroup
        ? chatService.createGroup({ name: name.trim(), memberIds: selected.map((u) => u._id) })
        : chatService.openDirect(selected[0]._id),
    onSuccess: (data) => openConversation(data.conversation._id),
    onError: (error) => Alert.alert('Không tạo được cuộc trò chuyện', messageOf(error)),
  });

  const toggle = (user: ChatParticipantProfile) =>
    setSelected((current) => {
      if (current.some((u) => u._id === user._id)) {
        return current.filter((u) => u._id !== user._id);
      }
      return isGroup ? [...current, user] : [user];
    });

  const canSubmit = selected.length > 0 && (!isGroup || name.trim().length > 0);

  return (
    <View style={styles.container}>
      {isGroup && (
        <TextField
          label="Tên nhóm"
          value={name}
          onChangeText={setName}
          placeholder="Ví dụ: Đội Sao Vàng"
          maxLength={100}
        />
      )}

      <UserSearch
        selected={selected}
        onToggle={toggle}
        label={isGroup ? 'Mời thành viên' : 'Tìm người để nhắn tin'}
      />

      <View style={styles.action}>
        <Button
          title={isGroup ? 'Tạo nhóm' : 'Bắt đầu trò chuyện'}
          onPress={() => create.mutate()}
          disabled={!canSubmit}
          loading={create.isPending}
        />
      </View>
    </View>
  );
}

export default function NewChatScreen({ mode }: { mode: 'direct' | 'group' }) {
  return (
    <RequireAuth message="Đăng nhập để bắt đầu một cuộc trò chuyện.">
      <NewChat mode={mode} />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  action: { paddingTop: spacing.lg },
});
