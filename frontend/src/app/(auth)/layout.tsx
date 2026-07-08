import Link from 'next/link';
import { CalendarDays, Sparkles, Users } from 'lucide-react';
import Logo from '@/components/layout/Logo';

const HIGHLIGHTS = [
  { icon: CalendarDays, text: 'Đặt sân trực tuyến trong 30 giây' },
  { icon: Users, text: 'Quản lý đội bóng & tuyển thành viên' },
  { icon: Sparkles, text: 'AI ghép trận với đối thủ vừa sức' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Panel thương hiệu (ẩn trên mobile) */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Hoạ tiết sân bóng */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(circle at center, transparent 118px, currentColor 120px, currentColor 122px, transparent 124px), linear-gradient(currentColor 2px, transparent 2px)',
            backgroundSize: '100% 100%, 100% 25%',
            backgroundPosition: 'center, 0 0',
          }}
        />
        <Link href="/" className="relative z-10 flex items-center gap-2 font-heading text-2xl font-bold">
          Match<span className="opacity-80">Ball</span>
        </Link>

        <div className="relative z-10">
          <h1 className="max-w-md font-heading text-5xl font-bold leading-tight">
            Sân chơi của cộng đồng bóng đá phong trào
          </h1>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-lg">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <Icon className="size-5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm opacity-70">
          © {new Date().getFullYear()} MatchBall
        </p>
      </aside>

      {/* Cột form */}
      <main className="flex items-center justify-center bg-background p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
