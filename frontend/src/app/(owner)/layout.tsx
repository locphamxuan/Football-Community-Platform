import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import OwnerSidebar from '@/components/layout/OwnerSidebar';
import RoleGuard from '@/components/dashboard/RoleGuard';

export const metadata: Metadata = {
  title: 'Quản lý sân',
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row md:py-8">
        <OwnerSidebar />
        <main className="min-w-0 flex-1">
          <RoleGuard
            allow={['field_owner', 'admin']}
            deniedTitle="Tài khoản chưa phải chủ sân"
            deniedDescription="Khu quản lý sân chỉ dành cho tài khoản có quyền chủ sân. Liên hệ ban quản trị để được nâng quyền."
          >
            {children}
          </RoleGuard>
        </main>
      </div>
    </div>
  );
}
