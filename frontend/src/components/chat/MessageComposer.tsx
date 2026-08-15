'use client';

import { useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MESSAGE_MAX_LENGTH } from '@/lib/constants';

/** Ngừng gõ chừng này thì báo "hết gõ" cho người kia, khỏi treo chữ "đang nhập…" mãi. */
const TYPING_IDLE_MS = 2000;

/**
 * Ô soạn tin.
 *
 * Enter gửi, Shift+Enter xuống dòng — đúng thói quen của mọi khung chat. Ô tự cao dần theo
 * nội dung nên tin nhắn dài vẫn đọc được trước khi gửi.
 */
export default function MessageComposer({
  onSend,
  onTyping,
  disabled,
}: {
  onSend: (body: string) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}) {
  const [body, setBody] = useState('');
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    onTyping(false);
  };

  const handleChange = (value: string) => {
    setBody(value);

    if (!value.trim()) {
      stopTyping();
      return;
    }

    if (!idleTimer.current) onTyping(true);
    else clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setBody('');
    stopTyping();
  };

  return (
    <form
      className="flex items-end gap-2 border-t p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Textarea
        value={body}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder="Nhập tin nhắn… (Enter để gửi, Shift+Enter xuống dòng)"
        aria-label="Nội dung tin nhắn"
        className="max-h-32 min-h-9 resize-none"
      />
      <Button type="submit" size="icon" className="cursor-pointer" aria-label="Gửi tin nhắn" disabled={!body.trim() || disabled}>
        <SendHorizontal />
      </Button>
    </form>
  );
}
