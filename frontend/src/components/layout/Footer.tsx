import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import Logo from '@/components/layout/Logo';

const EXPLORE_LINKS = [
  { href: '/fields', label: 'Tìm sân bóng' },
  { href: '/teams', label: 'Đội bóng' },
  { href: '/teams/create', label: 'Tạo đội mới' },
];

const ACCOUNT_LINKS = [
  { href: '/login', label: 'Đăng nhập' },
  { href: '/register', label: 'Đăng ký' },
  { href: '/bookings', label: 'Sân đã đặt' },
];

export default function Footer() {
  return (
    <footer className="border-t bg-sidebar">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Nền tảng kết nối cộng đồng bóng đá phong trào — đặt sân trực tuyến,
            quản lý đội bóng và tìm đối thủ phù hợp bằng AI.
          </p>
        </div>

        <nav aria-label="Khám phá">
          <h3 className="font-heading text-lg font-semibold">Khám phá</h3>
          <ul className="mt-3 space-y-2">
            {EXPLORE_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="font-heading text-lg font-semibold">Liên hệ</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0" aria-hidden />
              support@matchball.vn
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" aria-hidden />
              1900 0000
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden />
              TP. Hồ Chí Minh, Việt Nam
            </li>
          </ul>
          <ul className="mt-4 space-y-2">
            {ACCOUNT_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} MatchBall. Nền tảng cộng đồng bóng đá phong trào.
        </p>
      </div>
    </footer>
  );
}
