import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import AdminSidebar from '@/components/layout/AdminSidebar';
import RoleGuard from '@/components/dashboard/RoleGuard';

export const metadata: Metadata = {
  title: 'Quản trị nền tảng',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row md:py-8">
        <AdminSidebar />
        <main className="min-w-0 flex-1">
          <RoleGuard
            allow={['admin']}
            deniedTitle="Khu vực quản trị"
            deniedDescription="Chỉ quản trị viên nền tảng mới xem được số liệu vận hành và doanh thu thuê bao."
          >
            {children}
          </RoleGuard>
        </main>
      </div>
    </div>
  );
}
