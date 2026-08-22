'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOpenConversation } from '@/hooks/useChat';
import type { ApiResponse, ConversationContextType } from '@/types';

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
  variant = 'outline',
  size = 'sm',
  className,
}: {
  recipientId: string;
  contextType: ConversationContextType;
  contextRef: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
}) {
  const router = useRouter();
  const openConversation = useOpenConversation();

  const handleClick = () => {
    openConversation.mutate(
      { recipientId, contextType, contextRef },
      {
        onSuccess: (res) => router.push(`/chat/${res.data.data.conversation._id}`),
        onError: (err) => {
          const message = (err as AxiosError<ApiResponse<null>>).response?.data?.message
            ?? 'Không mở được cuộc trò chuyện';
          toast.error(message);
        },
      }
    );
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={openConversation.isPending}
      onClick={handleClick}
    >
      <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
      {label}
    </Button>
  );
}
