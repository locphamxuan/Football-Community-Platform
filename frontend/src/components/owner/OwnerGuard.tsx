'use client';

import RoleGuard from '@/components/dashboard/RoleGuard';

/** Chỉ cho chủ sân (hoặc admin) vào khu quản lý sân. */
export default function OwnerGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard
      allow={['field_owner', 'admin']}
      deniedTitle="Tài khoản chưa phải chủ sân"
      deniedDescription="Khu quản lý sân chỉ dành cho tài khoản có quyền chủ sân. Liên hệ ban quản trị để được nâng quyền."
    >
      {children}
    </RoleGuard>
  );
}
