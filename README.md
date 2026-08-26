# Football Community Platform

Nền tảng cộng đồng bóng đá phong trào: người chơi tìm sân trống và đặt sân, đội bóng thách
đấu nhau và tính Elo, chủ sân quản lý sân/lịch đặt và trả phí thuê bao cho nền tảng, admin
vận hành toàn hệ thống. Một tài khoản có thể mang nhiều vai trò cùng lúc.

**Doanh thu nền tảng đến từ phí thuê bao chủ sân trả hàng tháng — không phải tiền khách trả
để đặt sân (đó là GMV, thuộc về chủ sân).** Đây là điểm thiết kế quan trọng nhất của dự án,
chi phối cách mọi dashboard tách bạch hai dòng tiền.

Tài liệu đầy đủ (kiến trúc, API, quy tắc nghiệp vụ, vận hành, lộ trình) nằm ở
[`docs/`](docs/README.md).

## Bốn vai trò

| Vai trò | Làm được gì |
|---|---|
| Người chơi | Tìm sân, đặt sân, đánh giá, tham gia đội, thách đấu |
| Quản lý đội | Tạo đội, quản lý thành viên, gửi/nhận lời mời thi đấu, nhập kết quả |
| Chủ sân | Đăng sân/sân con, duyệt lịch đặt, xem doanh thu, trả phí thuê bao |
| Admin | Duyệt sân, quản lý người dùng, đối soát hoá đơn, xem toàn cảnh nền tảng |

## Kiến trúc

Một repo, bốn thư mục:

```
backend/    API Express + Mongoose (JavaScript thuần)
frontend/   Web Next.js 16 App Router (TypeScript)
mobile/     App Expo / React Native (TypeScript)
shared/     Hợp đồng API — types.ts, không có giá trị runtime
docs/       Tài liệu sản phẩm, kiến trúc, API, nghiệp vụ, vận hành
```

`shared/types.ts` chỉ chứa `type`/`interface`, TypeScript xoá sạch lúc biên dịch nên cả
Next.js lẫn Metro (mobile) đều import thẳng mà không cần cấu hình gì thêm. Đổi response
backend thì sửa file này trước — web và mobile fail type-check cho tới khi được cập nhật theo.

## Công nghệ dùng

**Backend** — Node.js, Express, MongoDB (Mongoose, MongoDB Atlas), Redis (ioredis) cho cache
và rate limit, JWT (access + refresh token xoay vòng, cookie `httpOnly`) cho xác thực,
Socket.IO (+ Redis adapter) cho chat thời gian thực, Zod cho validate request, Cloudinary cho
ảnh, Nodemailer cho email, VNPay cho thanh toán trực tuyến (kiến trúc theo interface để thêm
cổng khác không sửa luồng nghiệp vụ), Winston cho log, Jest + Supertest cho test.

**Frontend** — Next.js 16 (App Router), TypeScript, Tailwind CSS, TanStack Query cho data
fetching/cache, Zustand cho state client, Axios, Zod, Vitest + Testing Library cho test.

**Mobile** — Expo / React Native, TypeScript, expo-router cho điều hướng, Expo Push cho thông
báo đẩy, Jest + jest-expo + Testing Library React Native cho test.

**Hạ tầng chung** — CI trên GitHub Actions (lint/typecheck/test/build tách theo từng phía qua
`dorny/paths-filter`, `npm audit` chặn lỗ hổng mức critical), CodeQL quét bảo mật tĩnh hàng
tuần, Dependabot cập nhật dependency, Docker Compose cho Redis lúc phát triển local.

## Chạy local

```bash
# 1. Redis — backend không khởi động được nếu thiếu
docker compose up -d redis

# 2. Backend — http://localhost:5001
cd backend && npm install && npm run dev

# 3. Frontend — http://localhost:3001
cd frontend && npm install && npm run dev

# 4. Mobile
cd mobile && npm install && npm start
```

Cần biến môi trường trong `backend/.env` (chép từ `backend/.env.example`) và
`frontend/.env.local` — chi tiết đầy đủ ở [`docs/07-van-hanh.md`](docs/07-van-hanh.md).

## Test và verify

```bash
cd backend  && npm run lint && npm test
cd frontend && npx tsc --noEmit && npm run lint && npm test && npm run build
cd mobile   && npm run typecheck && npm test
```

Sửa `shared/types.ts` chạm cả web lẫn mobile — verify cả hai. Chi tiết ở
[`docs/06-kiem-thu.md`](docs/06-kiem-thu.md).

## Tài liệu

| | |
|---|---|
| [01 — Tổng quan sản phẩm](docs/01-tong-quan.md) | Vấn đề giải quyết, mô hình doanh thu |
| [02 — Kiến trúc](docs/02-kien-truc.md) | Một request đi qua những tầng nào |
| [03 — Tham chiếu API](docs/03-api.md) | Endpoint, quyền, response |
| [04 — Quy tắc nghiệp vụ](docs/04-nghiep-vu.md) | Giá, huỷ đơn, Elo, hạn mức gói |
| [05 — Redis và rate limit](docs/05-redis-rate-limit.md) | Cache, hạn mức, Redis chết thì sao |
| [06 — Kiểm thử](docs/06-kiem-thu.md) | Test nằm ở đâu, viết thêm ra sao |
| [07 — Vận hành](docs/07-van-hanh.md) | Biến môi trường, chạy local, CI |
| [08 — Lộ trình](docs/08-lo-trinh.md) | Việc làm tiếp theo, theo thứ tự ưu tiên |
