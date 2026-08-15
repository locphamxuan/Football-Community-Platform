import ChatAvatar from '@/components/chat/ChatAvatar';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * Một tin nhắn trong khung chat.
 *
 * Tin hệ thống ("A đã thêm B vào nhóm") nằm giữa, không có bong bóng và không có avatar:
 * nó không phải lời của ai cả, và vẽ nó như một tin nhắn thường sẽ khiến người đọc tưởng
 * có người vừa nói câu đó.
 */
export default function MessageBubble({
  message,
  isMine,
  startsCluster,
  showSender,
  seenLabel,
}: {
  message: ChatMessage;
  isMine: boolean;
  startsCluster: boolean;
  /** Nhóm cần biết ai đang nói; hội thoại tay đôi thì thừa. */
  showSender: boolean;
  /** "Đã xem" dưới tin cuối cùng của mình, nếu có người đã đọc tới đó. */
  seenLabel?: string;
}) {
  if (message.kind === 'system') {
    return (
      <li className="my-2 text-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {message.body}
        </span>
      </li>
    );
  }

  return (
    <li className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
      {!isMine && (
        <span className={cn('w-8 shrink-0', !startsCluster && 'invisible')}>
          <ChatAvatar name={message.sender?.fullName ?? ''} src={message.sender?.avatar} size="sm" />
        </span>
      )}

      <div className={cn('max-w-[75%] min-w-0', isMine ? 'items-end text-right' : 'items-start')}>
        {showSender && startsCluster && !isMine && (
          <p className="mb-0.5 px-1 text-xs text-muted-foreground">
            {message.sender?.fullName ?? 'Người dùng'}
          </p>
        )}
        <p
          className={cn(
            'inline-block rounded-2xl px-3 py-2 text-left text-sm break-words whitespace-pre-wrap',
            isMine ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}
          // Giờ gửi để ở tooltip: hiện dưới mỗi bong bóng thì cột chữ bị cắt vụn,
          // mà người đọc chỉ cần nó khi thật sự thắc mắc.
          title={new Date(message.createdAt).toLocaleString('vi-VN')}
        >
          {message.body}
        </p>
        <p className="mt-0.5 px-1 text-[11px] text-muted-foreground">
          {timeOf(message.createdAt)}
          {seenLabel ? ` · ${seenLabel}` : ''}
        </p>
      </div>
    </li>
  );
}
