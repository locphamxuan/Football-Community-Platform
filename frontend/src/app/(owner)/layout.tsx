import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import OwnerSidebar from '@/components/layout/OwnerSidebar';
import OwnerGuard from '@/components/owner/OwnerGuard';

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
          <OwnerGuard>{children}</OwnerGuard>
        </main>
      </div>
    </div>
  );
}
