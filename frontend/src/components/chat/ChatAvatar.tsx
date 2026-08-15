import { Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Ảnh đại diện của một hội thoại hoặc một người.
 *
 * Nhóm chưa có ảnh riêng thì hiện biểu tượng nhiều người thay vì chữ cái đầu của tên nhóm —
 * "ĐS" cho "Đội Sao Vàng" trông y hệt một người tên tắt là ĐS.
 */
export default function ChatAvatar({
  name,
  src,
  isGroup = false,
  size = 'default',
  className,
}: {
  name: string;
  src?: string;
  isGroup?: boolean;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}) {
  return (
    <Avatar size={size} className={cn('shrink-0', className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback>
        {isGroup ? <Users className="size-4" aria-hidden /> : initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
