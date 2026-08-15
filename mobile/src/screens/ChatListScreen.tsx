import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { Conversation } from '@fcp/shared';
import { Avatar, Button, EmptyState, ErrorState, Loading } from '../components/ui';
import RequireAuth from '../components/RequireAuth';
import { chatService } from '../services/chat.service';
import { chatKeys, useChatRealtime } from '../lib/chatSocket';
import { conversationTitle, previewOf, unreadOf } from '../domain/chat';
import { useAuth } from '../lib/auth';
import { canChat } from '../domain/roles';
import { messageOf } from '../lib/errors';
import { formatRelativeTime } from '../domain/format';
import { colors, fontSize, radius, spacing } from '../theme';

const PAGE_SIZE = 50;

function ConversationRow({
  conversation,
  userId,
}: {
  conversation: Conversation;
  userId?: string;
}) {
  const title = conversationTitle(conversation, userId);
  const unread = unreadOf(conversation, userId);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${title}, ${unread} tin chưa đọc` : title}
      onPress={() => router.push(`/chat/${conversation._id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Avatar name={title} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.title, unread > 0 && styles.titleUnread]} numberOfLines={1}>
            {title}
          </Text>
          {!!conversation.lastMessage?.sentAt && (
            <Text style={styles.time}>{formatRelativeTime(conversation.lastMessage.sentAt)}</Text>
          )}
        </View>
        <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
          {previewOf(conversation, userId)}
        </Text>
      </View>
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Inbox() {
  const { user } = useAuth();
  // Mở realtime ngay ở hộp thư: tin mới phải đẩy dòng hội thoại lên đầu mà không cần
  // người dùng kéo xuống làm mới.
  useChatRealtime();

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: chatKeys.conversations,
    queryFn: () => chatService.conversations({ limit: PAGE_SIZE }),
    enabled: canChat(user?.roles),
  });

  if (!canChat(user?.roles)) {
    return (
      <EmptyState
        title="Tài khoản quản trị không dùng chat"
        hint="Quản trị viên nền tảng xử lý khiếu nại bằng công cụ quản trị, không nhắn tin trực tiếp."
      />
    );
  }

  if (isLoading) return <Loading label="Đang tải tin nhắn" />;
  if (error) return <ErrorState message={messageOf(error)} onRetry={refetch} />;

  const conversations = data?.conversations ?? [];

  return (
    <View style={styles.flex}>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Nhắn tin mới" onPress={() => router.push('/chat/new?mode=direct')} />
        </View>
        <View style={styles.action}>
          <Button
            title="Tạo nhóm"
            variant="outline"
            onPress={() => router.push('/chat/new?mode=group')}
          />
        </View>
      </View>

      {conversations.length === 0 ? (
        <EmptyState
          title="Chưa có cuộc trò chuyện nào"
          hint="Nhắn tin cho chủ sân, đồng đội, hoặc lập một nhóm cho cả đội."
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(conversation) => conversation._id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => <ConversationRow conversation={item} userId={user?.id} />}
        />
      )}
    </View>
  );
}

export default function ChatListScreen() {
  return (
    <RequireAuth message="Đăng nhập để nhắn tin với chủ sân, đồng đội và bạn bè.">
      <Inbox />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.sm },
  action: { flex: 1 },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  rowPressed: { opacity: 0.7 },
  rowBody: { flex: 1 },
  rowTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { color: colors.text, flex: 1, fontSize: fontSize.md },
  titleUnread: { fontWeight: '700' },
  time: { color: colors.textSubtle, fontSize: fontSize.xs },
  preview: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  previewUnread: { color: colors.text, fontWeight: '600' },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: colors.white, fontSize: fontSize.xs, fontWeight: '700' },
});
