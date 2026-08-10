import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import ManagerSidebar from '@/components/layout/ManagerSidebar';
import RoleGuard from '@/components/dashboard/RoleGuard';

export const metadata: Metadata = {
  title: 'Quản lý đội bóng',
};

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row md:py-8">
        <ManagerSidebar />
        <main className="min-w-0 flex-1">
          <RoleGuard
            allow={['team_manager', 'admin']}
            deniedTitle="Chưa dẫn dắt đội nào"
            deniedDescription="Khu quản lý đội mở ra sau khi bạn tạo một đội bóng — người tạo đội chính là quản lý đội đó."
          >
            {children}
          </RoleGuard>
        </main>
      </div>
    </div>
  );
}
