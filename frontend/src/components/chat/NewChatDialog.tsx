'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import UserPicker from '@/components/chat/UserPicker';
import { useCreateGroup, useOpenDirect } from '@/hooks/useChat';
import type { AxiosError } from 'axios';
import type { ApiResponse, ChatParticipantProfile } from '@/types';

const errorMessage = (err: unknown, fallback: string) =>
  (err as AxiosError<ApiResponse<null>>)?.response?.data?.message ?? fallback;

/**
 * Bắt đầu một cuộc trò chuyện mới: nhắn thẳng cho một người, hoặc lập một nhóm.
 *
 * Hai việc dùng chung một hộp thoại vì chúng chỉ khác nhau ở "chọn một" hay "chọn nhiều
 * người và đặt tên" — tách đôi thì hai bản sao của cùng một ô tìm người sẽ trôi khỏi nhau.
 */
export default function NewChatDialog({
  mode,
  onClose,
}: {
  mode: 'direct' | 'group' | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ChatParticipantProfile[]>([]);
  const [name, setName] = useState('');
  const openDirect = useOpenDirect();
  const createGroup = useCreateGroup();

  const isGroup = mode === 'group';

  // Dọn lúc đóng chứ không lúc mở: mở lại phải là một tờ giấy trắng, và làm sạch ngay khi
  // đóng thì không cần một effect chạy theo `mode` chỉ để xoá state.
  const close = () => {
    setSelected([]);
    setName('');
    onClose();
  };

  const toggle = (user: ChatParticipantProfile) =>
    setSelected((current) => {
      if (current.some((u) => u._id === user._id)) {
        return current.filter((u) => u._id !== user._id);
      }
      return isGroup ? [...current, user] : [user];
    });

  const goToConversation = (id: string) => {
    close();
    router.push(`/chat/${id}`);
  };

  const submit = () => {
    if (!selected.length) return;

    if (isGroup) {
      createGroup.mutate(
        { name: name.trim(), memberIds: selected.map((u) => u._id) },
        {
          onSuccess: (res) => goToConversation(res.data.data.conversation._id),
          onError: (err) => toast.error(errorMessage(err, 'Không tạo được nhóm')),
        }
      );
      return;
    }

    openDirect.mutate(selected[0]._id, {
      onSuccess: (res) => goToConversation(res.data.data.conversation._id),
      onError: (err) => toast.error(errorMessage(err, 'Không mở được cuộc trò chuyện')),
    });
  };

  const isPending = openDirect.isPending || createGroup.isPending;
  const canSubmit = selected.length > 0 && (!isGroup || name.trim().length > 0);

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isGroup ? 'Tạo nhóm chat' : 'Nhắn tin mới'}</DialogTitle>
          <DialogDescription>
            {isGroup
              ? 'Đặt tên nhóm và mời những người bạn muốn trò chuyện cùng.'
              : 'Tìm người bạn muốn nhắn tin.'}
          </DialogDescription>
        </DialogHeader>

        {isGroup && (
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Tên nhóm</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Đội Sao Vàng"
              maxLength={100}
              className="h-9"
            />
          </div>
        )}

        <UserPicker
          selected={selected}
          onToggle={toggle}
          multiple={isGroup}
          label={isGroup ? 'Tìm thành viên' : 'Tìm người để nhắn tin'}
        />

        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={close}>
            Huỷ
          </Button>
          <Button className="cursor-pointer" onClick={submit} disabled={!canSubmit || isPending}>
            {isGroup ? 'Tạo nhóm' : 'Bắt đầu trò chuyện'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
