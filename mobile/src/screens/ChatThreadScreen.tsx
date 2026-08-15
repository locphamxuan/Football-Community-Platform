import { useEffect, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ChatMessage } from '@fcp/shared';
import { Avatar, ErrorState, Loading } from '../components/ui';
import RequireAuth from '../components/RequireAuth';
import { chatService } from '../services/chat.service';
import { chatKeys, useChatRealtime } from '../lib/chatSocket';
import { conversationTitle, isSeenByOthers, participantsExcept } from '../domain/chat';
import { useAuth } from '../lib/auth';
import { messageOf } from '../lib/errors';
import { colors, fontSize, radius, spacing } from '../theme';

const PAGE_SIZE = 50;
/** Ngừng gõ chừng này thì báo "hết gõ", khỏi treo chữ "đang nhập…" bên máy người kia. */
const TYPING_IDLE_MS = 2000;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function Bubble({
  message,
  isMine,
  showSender,
  seen,
}: {
  message: ChatMessage;
  isMine: boolean;
  showSender: boolean;
  seen: boolean;
}) {
  // Tin hệ thống ("A đã thêm B vào nhóm") không phải lời của ai — vẽ nó như một tin nhắn
  // thường sẽ khiến người đọc tưởng có người vừa nói câu đó.
  if (message.kind === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.body}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {showSender && !isMine && (
          <Text style={styles.sender}>{message.sender?.fullName ?? 'Người dùng'}</Text>
        )}
        <Text style={[styles.body, isMine && styles.bodyMine]}>{message.body}</Text>
        <Text style={[styles.meta, isMine && styles.metaMine]}>
          {timeOf(message.createdAt)}
          {seen ? ' · Đã xem' : ''}
        </Text>
      </View>
    </View>
  );
}

function Thread({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { typingUsers, notifyTyping } = useChatRealtime(conversationId);

  const conversationQuery = useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => chatService.conversation(conversationId),
  });

  const messagesQuery = useQuery({
    queryKey: chatKeys.messages(conversationId),
    // Backend trả tin mới nhất trước — đúng thứ tự mà `FlatList inverted` cần, nên
    // không đảo lại ở đây.
    queryFn: async () => (await chatService.messages(conversationId, { limit: PAGE_SIZE })).messages,
  });

  const markRead = useMutation({
    mutationFn: () => chatService.markRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
      queryClient.invalidateQueries({ queryKey: chatKeys.unread });
    },
  });

  const send = useMutation({
    mutationFn: (body: string) => chatService.send(conversationId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });

  const newestId = messagesQuery.data?.[0]?._id;

  // Người đang nhìn vào tin nhắn thì đã đọc nó rồi — bắt họ bấm thêm một nút "đã đọc"
  // là bắt làm hộ máy.
  useEffect(() => {
    if (newestId) markRead.mutate();
    // `markRead` là mutation mới mỗi lần render; đưa vào deps là gọi lại vô hạn.
  }, [conversationId, newestId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopTyping = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    notifyTyping(false);
  };

  const onChangeDraft = (value: string) => {
    setDraft(value);
    if (!value.trim()) return stopTyping();

    if (!idleTimer.current) notifyTyping(true);
    else clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft('');
    stopTyping();
    send.mutate(body);
  };

  if (conversationQuery.isLoading) return <Loading label="Đang mở cuộc trò chuyện" />;
  if (conversationQuery.error) {
    return <ErrorState message={messageOf(conversationQuery.error)} onRetry={conversationQuery.refetch} />;
  }

  const conversation = conversationQuery.data!.conversation;
  const isGroup = conversation.type === 'group';
  const title = conversationTitle(conversation, user?.id);
  const others = participantsExcept(conversation, user?.id);
  const typingNames = others
    .filter((p) => typingUsers.includes(p.user._id))
    .map((p) => p.user.fullName);
  const messages = messagesQuery.data ?? [];
  const newestMine = messages.find((m) => m.sender?._id === user?.id);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable
        accessibilityRole={isGroup ? 'button' : 'header'}
        disabled={!isGroup}
        onPress={() => router.push(`/chat/group/${conversationId}`)}
        style={styles.header}
      >
        <Avatar name={title} size={36} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.headerHint} numberOfLines={1}>
            {isGroup
              ? `${conversation.participants.length} thành viên · Chạm để xem nhóm`
              : `@${others[0]?.user.username ?? ''}`}
          </Text>
        </View>
      </Pressable>

      {messagesQuery.isLoading ? (
        <Loading label="Đang tải tin nhắn" />
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(message) => message._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên.</Text>
          }
          renderItem={({ item }) => (
            <Bubble
              message={item}
              isMine={item.sender?._id === user?.id}
              showSender={isGroup}
              seen={item._id === newestMine?._id && isSeenByOthers(conversation, item, user?.id)}
            />
          )}
        />
      )}

      {typingNames.length > 0 && (
        <Text style={styles.typing} accessibilityLiveRegion="polite">
          {typingNames.join(', ')} đang nhập…
        </Text>
      )}

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder="Nhập tin nhắn"
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel="Nội dung tin nhắn"
          multiline
          maxLength={2000}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gửi tin nhắn"
          accessibilityState={{ disabled: !draft.trim() || send.isPending }}
          disabled={!draft.trim() || send.isPending}
          onPress={submit}
          style={({ pressed }) => [
            styles.send,
            (!draft.trim() || send.isPending) && styles.sendDisabled,
            pressed && styles.rowPressed,
          ]}
        >
          <Text style={styles.sendText}>Gửi</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function ChatThreadScreen({ conversationId }: { conversationId: string }) {
  return (
    <RequireAuth message="Đăng nhập để xem cuộc trò chuyện này.">
      <Thread conversationId={conversationId} />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  headerText: { flex: 1 },
  headerTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  headerHint: { color: colors.textMuted, fontSize: fontSize.xs },
  list: { padding: spacing.lg },
  empty: { color: colors.textMuted, padding: spacing.xl, textAlign: 'center' },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.sm },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { borderRadius: radius.lg, maxWidth: '80%', padding: spacing.md },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTheirs: { backgroundColor: colors.surface },
  sender: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 2 },
  body: { color: colors.text, fontSize: fontSize.md },
  bodyMine: { color: colors.white },
  meta: { color: colors.textSubtle, fontSize: 11, marginTop: 4 },
  metaMine: { color: colors.primarySoft },
  systemRow: { alignItems: 'center', marginBottom: spacing.sm },
  systemText: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    color: colors.textMuted,
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  typing: { color: colors.textMuted, fontSize: fontSize.xs, paddingHorizontal: spacing.lg },
  composer: {
    alignItems: 'flex-end',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    color: colors.text,
    flex: 1,
    fontSize: fontSize.md,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  send: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  rowPressed: { opacity: 0.8 },
});
