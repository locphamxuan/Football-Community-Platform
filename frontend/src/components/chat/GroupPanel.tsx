'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogOut, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import ChatAvatar from '@/components/chat/ChatAvatar';
import UserPicker from '@/components/chat/UserPicker';
import { useAddMembers, useLeaveGroup, useRemoveMember, useRenameGroup } from '@/hooks/useChat';
import { isGroupAdmin } from '@/lib/chat';
import useAuthStore from '@/stores/authStore';
import type { AxiosError } from 'axios';
import type { ApiResponse, ChatParticipantProfile, Conversation } from '@/types';

const errorMessage = (err: unknown, fallback: string) =>
  (err as AxiosError<ApiResponse<null>>)?.response?.data?.message ?? fallback;

/**
 * Bảng điều khiển của một nhóm: thành viên, đổi tên, thêm, gỡ, rời nhóm.
 *
 * Thành viên thường vẫn mở được để xem nhóm gồm những ai — họ chỉ không thấy các nút sửa,
 * vì backend cũng sẽ từ chối đúng những thao tác ấy.
 */
export default function GroupPanel({
  conversation,
  open,
  onClose,
}: {
  conversation: Conversation;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const [name, setName] = useState(conversation.name);
  const [toAdd, setToAdd] = useState<ChatParticipantProfile[]>([]);

  const rename = useRenameGroup(conversation._id);
  const addMembers = useAddMembers(conversation._id);
  const removeMember = useRemoveMember(conversation._id);
  const leaveGroup = useLeaveGroup();

  const canManage = isGroupAdmin(conversation, userId);
  const memberIds = conversation.participants.map((p) => p.user._id);

  const submitRename = () => {
    const next = name.trim();
    if (!next || next === conversation.name) return;

    rename.mutate(next, {
      onSuccess: () => toast.success('Đã đổi tên nhóm'),
      onError: (err) => toast.error(errorMessage(err, 'Không đổi được tên nhóm')),
    });
  };

  const submitAdd = () => {
    if (!toAdd.length) return;

    addMembers.mutate(toAdd.map((u) => u._id), {
      onSuccess: () => {
        setToAdd([]);
        toast.success('Đã thêm thành viên');
      },
      onError: (err) => toast.error(errorMessage(err, 'Không thêm được thành viên')),
    });
  };

  const submitLeave = () => {
    leaveGroup.mutate(conversation._id, {
      onSuccess: () => {
        onClose();
        // Nhóm không còn là của mình nữa, ở lại màn hình cũ chỉ để nhận 403 ở mọi thao tác.
        router.push('/chat');
      },
      onError: (err) => toast.error(errorMessage(err, 'Không rời được nhóm')),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thông tin nhóm</DialogTitle>
          <DialogDescription>
            {conversation.participants.length} thành viên
            {canManage ? '' : ' · Chỉ quản trị nhóm mới sửa được nhóm'}
          </DialogDescription>
        </DialogHeader>

        {canManage && (
          <div className="space-y-1.5">
            <Label htmlFor="rename-group">Tên nhóm</Label>
            <div className="flex gap-2">
              <Input
                id="rename-group"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="h-9"
              />
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={submitRename}
                disabled={rename.isPending || !name.trim() || name.trim() === conversation.name}
              >
                Lưu
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-48 overflow-y-auto rounded-lg border p-1">
          <ul>
            {conversation.participants.map(({ user, role }) => (
              <li key={user._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <ChatAvatar name={user.fullName} src={user.avatar} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {user.fullName}
                    {user._id === userId && ' (bạn)'}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {role === 'admin' ? 'Quản trị nhóm' : `@${user.username}`}
                  </span>
                </span>
                {canManage && user._id !== userId && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer"
                    aria-label={`Gỡ ${user.fullName} khỏi nhóm`}
                    disabled={removeMember.isPending}
                    onClick={() =>
                      removeMember.mutate(user._id, {
                        onError: (err) => toast.error(errorMessage(err, 'Không gỡ được thành viên')),
                      })
                    }
                  >
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {canManage && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label>Thêm thành viên</Label>
              <UserPicker
                selected={toAdd}
                onToggle={(user) =>
                  setToAdd((current) =>
                    current.some((u) => u._id === user._id)
                      ? current.filter((u) => u._id !== user._id)
                      : [...current, user]
                  )
                }
                excludeIds={memberIds}
                label="Tìm người để thêm vào nhóm"
              />
              <Button
                className="w-full cursor-pointer"
                onClick={submitAdd}
                disabled={!toAdd.length || addMembers.isPending}
              >
                Thêm vào nhóm
              </Button>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="destructive"
            className="cursor-pointer"
            onClick={submitLeave}
            disabled={leaveGroup.isPending}
          >
            <LogOut />
            Rời nhóm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
