import { Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ConversationContextType } from '@fcp/shared';
import { Button } from './ui';
import { chatService } from '../services/chat.service';
import { chatKeys } from '../lib/chatSocket';
import { messageOf } from '../lib/errors';

/**
 * Nút "nhắn tin" gắn với một ngữ cảnh cụ thể — trang sân, lịch đặt, hay lời mời thi đấu.
 *
 * Bấm lần đầu mở hội thoại mới, bấm lại chỉ quay về đúng hội thoại cũ (khoá `key` ở
 * backend lo việc đó) — nên component này không cần tự nhớ đã mở hay chưa.
 */
export default function MessageContextButton({
  recipientId,
  contextType,
  contextRef,
  label = 'Nhắn tin',
}: {
  recipientId: string;
  contextType: ConversationContextType;
  contextRef: string;
  label?: string;
}) {
  const queryClient = useQueryClient();

  const openConversation = useMutation({
    mutationFn: () => chatService.openConversation({ recipientId, contextType, contextRef }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
      router.push(`/chat/${data.conversation._id}`);
    },
    onError: (err) => Alert.alert('Không mở được cuộc trò chuyện', messageOf(err)),
  });

  return (
    <Button
      title={label}
      variant="outline"
      loading={openConversation.isPending}
      onPress={() => openConversation.mutate()}
    />
  );
}
