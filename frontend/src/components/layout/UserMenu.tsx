'use client';

import Link from 'next/link';
import { CalendarDays, LogOut, Swords, User, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout } from '@/hooks/useAuth';
import useAuthStore from '@/stores/authStore';

export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  if (!user) return null;

  const initials = (user.fullName || user.username || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="relative size-9 rounded-full p-0 cursor-pointer"
            aria-label="Menu tài khoản"
          />
        }
      >
        <Avatar className="size-9">
          <AvatarImage src={user.avatar} alt={user.fullName} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <p className="truncate font-medium">{user.fullName}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />} className="cursor-pointer">
          <User className="size-4" />
          Hồ sơ của tôi
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/bookings" />} className="cursor-pointer">
          <CalendarDays className="size-4" />
          Sân đã đặt
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/match-requests" />} className="cursor-pointer">
          <Swords className="size-4" />
          Lời mời thi đấu
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/teams" />} className="cursor-pointer">
          <Users className="size-4" />
          Đội của tôi
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut className="size-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
