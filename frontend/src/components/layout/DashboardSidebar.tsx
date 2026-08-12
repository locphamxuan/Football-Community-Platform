'use client';

import { Bell, CalendarDays, Swords, User } from 'lucide-react';
import SidebarNav, { type SidebarLink } from '@/components/dashboard/SidebarNav';

const SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/profile', label: 'Hồ sơ của tôi', icon: User },
  { href: '/notifications', label: 'Thông báo', icon: Bell },
  { href: '/bookings', label: 'Sân đã đặt', icon: CalendarDays },
  { href: '/match-requests', label: 'Lời mời thi đấu', icon: Swords },
];

export default function DashboardSidebar() {
  return <SidebarNav links={SIDEBAR_LINKS} ariaLabel="Quản lý cá nhân" />;
}