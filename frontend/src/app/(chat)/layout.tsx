import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import RoleGuard from '@/components/dashboard/RoleGuard';

export const metadata: Metadata = {
  title: 'Tin nhắn',
};

/**
 * Khu chat có bố cục riêng: cao đúng một màn hình, không footer, không lề trang —
 * danh sách và khung chat tự cuộn bên trong, giống mọi ứng dụng nhắn tin.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <RoleGuard
        deny={['admin']}
        deniedTitle="Tài khoản quản trị không dùng chat"
        deniedDescription="Quản trị viên nền tảng xử lý khiếu nại bằng công cụ quản trị, không nhắn tin trực tiếp với người dùng."
      >
        {children}
      </RoleGuard>
    </div>
  );
}
