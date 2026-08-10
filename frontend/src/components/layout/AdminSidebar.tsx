'use client';

import { LayoutDashboard, ReceiptText, ShieldCheck, Users, Volleyball } from 'lucide-react';
import SidebarNav, { type SidebarLink } from '@/components/dashboard/SidebarNav';

const SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
  { href: '/admin/owners', label: 'Chủ sân', icon: ShieldCheck },
  { href: '/admin/invoices', label: 'Hoá đơn thuê', icon: ReceiptText },
  { href: '/admin/fields', label: 'Duyệt sân', icon: Volleyball },
  { href: '/admin/users', label: 'Người dùng', icon: Users },
];

export default function AdminSidebar() {
  return <SidebarNav links={SIDEBAR_LINKS} ariaLabel="Quản trị nền tảng" />;
}