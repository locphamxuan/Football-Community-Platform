import Navbar from '@/components/layout/Navbar';
import DashboardSidebar from '@/components/layout/DashboardSidebar';
import RoleGuard from '@/components/dashboard/RoleGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row md:py-8">
        <DashboardSidebar />
        <main className="min-w-0 flex-1">
          {/* Không giới hạn role: mọi vai trò đều có hồ sơ, thông báo và lịch đặt riêng.
              Thiếu cổng này thì khách vãng lai thấy khung trang rỗng rồi bị đá về /login
              bằng một lần tải lại toàn trang, sau khi các request đã 401. */}
          <RoleGuard>{children}</RoleGuard>
        </main>
      </div>
    </div>
  );
}
