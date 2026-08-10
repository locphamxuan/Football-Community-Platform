'use client';

import { CalendarCheck, CreditCard, LayoutDashboard, Star, TrendingUp, Volleyball } from 'lucide-react';
import SidebarNav, { type SidebarLink } from '@/components/dashboard/SidebarNav';

const SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/owner', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
  { href: '/owner/fields', label: 'Sân của tôi', icon: Volleyball },
  { href: '/owner/bookings', label: 'Lịch đặt sân', icon: CalendarCheck },
  { href: '/owner/revenue', label: 'Doanh thu', icon: TrendingUp },
  { href: '/owner/reviews', label: 'Đánh giá', icon: Star },
  { href: '/owner/billing', label: 'Gói dịch vụ', icon: CreditCard },
];

export default function OwnerSidebar() {
  return <SidebarNav links={SIDEBAR_LINKS} ariaLabel="Quản lý sân" />;
}