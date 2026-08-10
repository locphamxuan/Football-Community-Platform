'use client';

import { CalendarCheck, LayoutDashboard, Swords, Users } from 'lucide-react';
import SidebarNav, { type SidebarLink } from '@/components/dashboard/SidebarNav';

const SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/manager', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
  { href: '/manager/teams', label: 'Đội của tôi', icon: Users },
  { href: '/manager/matches', label: 'Lời mời thi đấu', icon: Swords },
  { href: '/manager/bookings', label: 'Lịch sân của đội', icon: CalendarCheck },
];

export default function ManagerSidebar() {
  return <SidebarNav links={SIDEBAR_LINKS} ariaLabel="Quản lý đội bóng" />;
}