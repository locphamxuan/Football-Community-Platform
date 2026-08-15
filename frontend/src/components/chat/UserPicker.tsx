'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import ChatAvatar from '@/components/chat/ChatAvatar';
import userService from '@/services/user.service';
import { cn } from '@/lib/utils';
import type { ChatParticipantProfile } from '@/types';

/** Backend đòi ít nhất 2 ký tự; hỏi sớm hơn chỉ nhận về 400. */
const MIN_TERM_LENGTH = 2;
/** Chờ người dùng ngừng gõ rồi mới hỏi — mỗi phím một request là cách làm nghẽn ô tìm kiếm. */
const DEBOUNCE_MS = 300;

/**
 * Ô tìm người: gõ tên, bấm để chọn.
 *
 * Dùng chung cho "nhắn tin mới" (chọn một người) và "tạo nhóm" / "thêm thành viên"
 * (chọn nhiều người) — cùng một danh sách gợi ý, khác nhau ở chỗ giữ lại bao nhiêu.
 */
export default function UserPicker({
  selected,
  onToggle,
  excludeIds = [],
  multiple = true,
  label = 'Tìm người',
}: {
  selected: ChatParticipantProfile[];
  onToggle: (user: ChatParticipantProfile) => void;
  /** Những người đã ở trong nhóm — hiện ra để bấm nhầm cũng không thêm lại được. */
  excludeIds?: string[];
  multiple?: boolean;
  label?: string;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const { data: users, isFetching } = useQuery({
    queryKey: ['users', 'search', debounced],
    queryFn: async () => (await userService.search(debounced)).data.data.users,
    enabled: debounced.length >= MIN_TERM_LENGTH,
  });

  const selectedIds = selected.map((u) => u._id);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Nhập tên hoặc tên đăng nhập"
          aria-label={label}
          className="h-9 pl-8"
        />
      </div>

      {multiple && selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((user) => (
            <li key={user._id}>
              <button
                type="button"
                onClick={() => onToggle(user)}
                className="cursor-pointer rounded-full bg-accent px-2.5 py-1 text-xs font-medium hover:bg-accent/70"
                aria-label={`Bỏ chọn ${user.fullName}`}
              >
                {user.fullName} ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="max-h-56 min-h-24 overflow-y-auto rounded-lg border p-1">
        {debounced.length < MIN_TERM_LENGTH ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Nhập ít nhất {MIN_TERM_LENGTH} ký tự để tìm
          </p>
        ) : isFetching ? (
          <div className="space-y-1 p-1">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : !users?.length ? (
          <p className="p-4 text-center text-xs text-muted-foreground">Không tìm thấy ai phù hợp</p>
        ) : (
          <ul>
            {users.map((user) => {
              const isSelected = selectedIds.includes(user._id);
              const isExcluded = excludeIds.includes(user._id);

              return (
                <li key={user._id}>
                  <button
                    type="button"
                    disabled={isExcluded}
                    onClick={() => onToggle(user)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent/60',
                      isExcluded && 'cursor-not-allowed opacity-50 hover:bg-transparent'
                    )}
                  >
                    <ChatAvatar name={user.fullName} src={user.avatar} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{user.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{user.username}</span>
                    </span>
                    {isExcluded ? (
                      <span className="text-xs text-muted-foreground">Đã ở trong nhóm</span>
                    ) : isSelected ? (
                      <Check className="size-4 text-primary" aria-label="Đã chọn" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
