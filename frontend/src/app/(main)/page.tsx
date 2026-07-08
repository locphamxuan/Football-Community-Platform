import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STATS = [
  { value: '500+', label: 'Sân bóng' },
  { value: '1.200+', label: 'Đội bóng' },
  { value: '8.000+', label: 'Trận đã diễn ra' },
];

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Đặt sân trực tuyến',
    desc: 'Xem lịch trống theo thời gian thực, giữ chỗ và thanh toán chỉ trong 30 giây — không cần gọi điện.',
  },
  {
    icon: Users,
    title: 'Quản lý đội bóng',
    desc: 'Tạo đội, tuyển thành viên, sắp lịch tập và theo dõi phong độ của cả đội ở một nơi.',
  },
  {
    icon: Sparkles,
    title: 'AI ghép trận',
    desc: 'Thuật toán AI phân tích trình độ và vị trí để gợi ý đối thủ vừa sức — trận nào cũng kịch tính.',
  },
];

const STEPS = [
  { icon: Search, title: 'Tìm sân gần bạn', desc: 'Lọc theo khu vực, loại sân, khung giờ và mức giá.' },
  { icon: CalendarDays, title: 'Đặt lịch ngay', desc: 'Chọn khung giờ trống và xác nhận đặt sân tức thì.' },
  { icon: Swords, title: 'Tìm đối thủ', desc: 'Để AI gợi ý đối thủ cùng trình độ, gửi lời mời thi đấu.' },
  { icon: Trophy, title: 'Ra sân & tận hưởng', desc: 'Thi đấu, chấm điểm trận đấu và xây phong độ đội bạn.' },
];

export default function HomePage() {
  return (
    <>
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        {/* Nền gradient + hoạ tiết */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent"
        />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge className="mb-4" variant="secondary">
              <Sparkles className="size-3.5" aria-hidden />
              Nền tảng cộng đồng bóng đá phong trào
            </Badge>
            <h1 className="font-heading text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
              Đặt sân. Lập đội.
              <br />
              <span className="text-primary">Tìm đối thủ.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              MatchBall kết nối mọi người yêu bóng đá — từ đặt sân trực tuyến, quản lý
              đội bóng đến ghép trận bằng AI. Tất cả trong một nền tảng.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="group" nativeButton={false} render={<Link href="/fields" />}>
                Tìm sân ngay
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/teams/create" />}>
                Tạo đội bóng
              </Button>
            </div>

            {/* Thống kê */}
            <dl className="mt-10 flex gap-8 sm:gap-12">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-heading text-3xl font-bold text-primary sm:text-4xl">{s.value}</dd>
                  <dd className="mt-1 text-sm text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Minh hoạ sân bóng (CSS thuần, không cần ảnh) */}
          <div className="relative hidden lg:block" aria-hidden>
            <div className="relative mx-auto aspect-[3/4] max-w-md overflow-hidden rounded-3xl bg-primary shadow-2xl">
              {/* Vạch sân */}
              <div className="absolute inset-4 rounded-2xl border-2 border-primary-foreground/40" />
              <div className="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 bg-primary-foreground/40" />
              <div className="absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary-foreground/40" />
              <div className="absolute left-1/2 top-4 h-16 w-40 -translate-x-1/2 rounded-b-xl border-2 border-t-0 border-primary-foreground/40" />
              <div className="absolute bottom-4 left-1/2 h-16 w-40 -translate-x-1/2 rounded-t-xl border-2 border-b-0 border-primary-foreground/40" />
              {/* Sọc cỏ */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_40px,rgb(255_255_255/0.06)_40px,rgb(255_255_255/0.06)_80px)]" />
            </div>
            {/* Card nổi */}
            <Card className="absolute -left-6 top-10 w-56 shadow-xl">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Sân Thống Nhất</p>
                  <p className="text-xs text-muted-foreground">Còn 3 khung giờ tối nay</p>
                </div>
              </CardContent>
            </Card>
            <Card className="absolute -right-4 bottom-14 w-60 shadow-xl">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">AI tìm thấy đối thủ!</p>
                  <p className="text-xs text-muted-foreground">FC Sấm Sét — trình độ tương đương</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ===== Tính năng ===== */}
      <section className="bg-sidebar py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-heading text-4xl font-bold sm:text-5xl">
              Mọi thứ đội bóng của bạn cần
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Từ khâu đặt sân đến tìm đối thủ — MatchBall lo hết để bạn chỉ việc ra sân.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <Card
                key={title}
                className="group transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <CardContent className="p-6">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-heading text-2xl font-semibold">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Cách hoạt động ===== */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-4xl font-bold sm:text-5xl">Ra sân trong 4 bước</h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Đơn giản đến mức đội trưởng nào cũng làm được.
            </p>
          </div>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="relative text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="mt-3 inline-block font-heading text-sm font-semibold text-primary">
                  Bước {i + 1}
                </span>
                <h3 className="mt-1 font-heading text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== Điểm nhấn AI ===== */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 md:pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-primary-foreground md:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgb(255_255_255/0.15),transparent_50%)]"
          />
          <div className="relative z-10 max-w-2xl">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="size-3.5" aria-hidden />
              Được hỗ trợ bởi AI
            </Badge>
            <h2 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
              Đối thủ vừa sức, trận đấu trọn vẹn
            </h2>
            <p className="mt-4 text-lg leading-relaxed opacity-90">
              AI của MatchBall phân tích trình độ, đội hình và lịch sử thi đấu để gợi ý
              đối thủ phù hợp nhất — không còn những trận chênh lệch 10-0.
            </p>
            <Button size="lg" variant="secondary" className="mt-8" nativeButton={false} render={<Link href="/register" />}>
              Trải nghiệm miễn phí
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
