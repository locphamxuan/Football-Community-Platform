# Bối cảnh dự án

> Cập nhật lần cuối: 2026-08-12
>
> Tài liệu đầy đủ nằm ở [`docs/`](../docs/README.md). File này chỉ trả lời "dự án đang ở đâu".

Nền tảng cộng đồng bóng đá: người chơi tìm sân và đặt sân, đội bóng thách đấu nhau, chủ sân quản lý sân và trả phí thuê bao cho nền tảng, admin vận hành.

## Kiến trúc

Một repo, bốn thư mục:

| Thư mục | Là gì | Chạy bằng |
|---|---|---|
| `backend/` | API Express + Mongoose, JavaScript thuần | `npm run dev` (cần Redis) |
| `frontend/` | Web Next.js 16 (App Router) | `npm run dev` → cổng 3001 |
| `mobile/` | App Expo / React Native | `npm start` |
| `shared/` | Hợp đồng API (`types.ts`), chỉ có type | import `@fcp/shared` |

MongoDB Atlas, Redis chạy qua `docker compose up -d redis`, ảnh lưu trên Cloudinary.

## Đã xong

**Nền tảng chung**
- Auth: đăng ký, xác minh email, đăng nhập, refresh token (token được sha256 trước khi bcrypt để phát hiện tái sử dụng), quên/đặt lại mật khẩu.
- Sân: tìm kiếm, lọc, trang chi tiết, sân con, khung giá theo buổi và theo ngày trong tuần.
- Đặt sân: đặt, xác nhận, hoàn thành, huỷ (người đặt phải huỷ trước giờ đá 2 tiếng), đánh dấu khách không đến.
- Đội bóng: tạo đội, mã mời, thành viên, lời mời thi đấu, nhập kết quả và tính Elo.
- Đánh giá sân kèm ảnh, chủ sân trả lời.

**Khu quản lý theo vai trò** (nhánh `feature/role-dashboards-and-billing`)
- Chủ sân: tổng quan, quản lý sân, lịch đặt, doanh thu theo tháng, hộp thư đánh giá, trang thuê bao.
- Quản lý đội: tổng quan, đội của tôi + chuyển quyền quản lý, lời mời thi đấu, lịch sân của đội.
- Admin: tổng quan nền tảng, theo dõi chủ sân, đối soát hoá đơn, duyệt sân, quản lý người dùng.
- Thuê bao: 3 gói (free/basic/pro), hạn mức số sân và sân con, hoá đơn thanh toán bằng chuyển khoản — chủ sân báo mã giao dịch, admin xác nhận.

**Hạ tầng kiểm thử** (nhánh `chore/testing-and-mobile-workspace`)
- Backend: Jest + supertest.
- Frontend: Vitest + Testing Library.
- Mobile: Jest + jest-expo + Testing Library React Native.
- CI chạy lint/typecheck/test/build riêng cho từng phía, có path filter.

**Phủ test, Redis/rate limit, tài liệu** (nhánh `feature/codegraph-tests-redis-docs`)
- Backend 497 test: mọi endpoint được kiểm ba cổng (401 / 403 / 400) và cả đường đi thành công; quy tắc nghiệp vụ của booking, billing, team, review, field, match request, auth đều có test riêng. `routes/`, `controllers/`, `middleware/`, `validations/` đạt 100% statement.
- Rate limit đếm trên Redis (dùng chung giữa các instance, không mất khi deploy), thêm limiter riêng cho request ghi, mọi limiter trả cùng một khuôn dạng lỗi JSON.
- Cache Redis không còn làm vỡ request khi Redis chết; `/health` báo trạng thái Redis.
- Frontend: test cho interceptor axios và authStore.
- `docs/` — tài liệu đầy đủ về sản phẩm, kiến trúc, API, nghiệp vụ, vận hành, lộ trình.
- CodeGraph (`.mcp.json`) để agent tra cứu codebase bằng đồ thị thay vì grep.

**Thông báo in-app** (nhánh `feature/notifications`)
- Hộp thư thông báo: bảy sự kiện nhạy cảm thời gian (lịch đặt mới / được xác nhận / bị huỷ, lời mời thi đấu, lời mời được trả lời, đối thủ nhập tỉ số, hoá đơn mới) tự bắn tới đúng người nhận.
- Bốn endpoint dưới `/notifications`, số chưa đọc cache trên Redis, thông báo tự hết hạn sau 90 ngày.
- Web: chuông trên thanh điều hướng (hỏi lại mỗi 60 giây) và trang `/notifications`.
- Đẩy tới điện thoại bằng Expo Push: mỗi thiết bị một token trong `User.expoPushTokens`, tôn trọng cờ `notifications.push`, token chết bị dọn khi Expo báo `DeviceNotRegistered`.

**App mobile cho người chơi** (nhánh `feature/mobile-app`)
- Điều hướng `expo-router` với 5 tab: tìm sân, lịch đặt, đội bóng, thông báo, hồ sơ.
- Đăng nhập / đăng ký / quên mật khẩu, token cất trong Keychain–Keystore, tự làm mới khi hết hạn.
- Tìm sân, chi tiết sân kèm đánh giá, đặt sân có kiểm tra khung giờ trống, huỷ đơn và viết đánh giá.
- Đội bóng (tạo, tham gia, rời), lời mời thi đấu và nhập tỉ số, hộp thư thông báo có deep link, hồ sơ.
- Thiết bị tự đăng ký nhận thông báo đẩy lúc đăng nhập và được gỡ lúc đăng xuất.

## Đang làm / còn dở

- **Thông báo đẩy chưa kiểm trên thiết bị thật** — Expo Go trên Android từ SDK 53 không cấp được push token, cần development build và `eas.projectId` trong `app.json`. Đường đi trên backend đã có test và đã chạy thử với stack thật.
- Mobile mới phục vụ **người chơi**. Chủ sân, quản lý đội và admin vẫn làm việc trên web.
- Tắt/bật theo từng loại thông báo chưa có: hồ sơ mới chỉ có cờ `notifications.email` / `notifications.push` cho tất cả.
- Chưa mở PR cho năm nhánh `feature/role-dashboards-and-billing`, `chore/testing-and-mobile-workspace`, `feature/codegraph-tests-redis-docs`, `feature/notifications`, `feature/mobile-app` (nhánh sau xây trên nhánh trước).

## Việc nên làm tiếp

Lộ trình đầy đủ kèm phạm vi và định nghĩa hoàn thành: [`docs/08-lo-trinh.md`](../docs/08-lo-trinh.md). Ba việc đầu bảng:

1. Cổng thanh toán trực tuyến cho hoá đơn thuê bao (VNPay/MoMo) — bỏ khâu admin đối soát tay.
2. Chat trong lời mời thi đấu, để hai đội chốt trận không phải nhảy sang Zalo.
3. Tắt/bật thông báo theo từng loại, thay cho một cờ chung.

## Quyết định và bẫy cần nhớ

- **Doanh thu nền tảng ≠ tiền đặt sân.** Tiền khách trả cho chủ sân là GMV, doanh thu nền tảng chỉ là hoá đơn thuê bao. Đừng gộp hai con số này ở bất kỳ dashboard nào.
- **Backend là JavaScript thuần**, không TypeScript — theo yêu cầu ban đầu của chủ dự án.
- **Form gửi kèm ảnh đi qua multipart/form-data**, nên mọi field tới backend đều là chuỗi. Schema Zod cho các form này phải dùng `z.coerce` hoặc helper `booleanish`, nếu không `z.number()`/`z.boolean()` luôn fail.
- **Sidebar phải là client component.** Chúng truyền icon lucide (function) cho `SidebarNav`; server component không serialize được function nên build sẽ vỡ lúc prerender.
- **`shared/types.ts` chỉ chứa type.** Thêm giá trị runtime vào đó là phải cấu hình thêm cho cả Next.js lẫn Metro.
- **RNTL 14 có `render()` bất đồng bộ.** Quên `await` thì `screen` rỗng và lỗi báo rất khó hiểu ("render function has not been called").
- Cổng: backend 5001, frontend 3001. Container `fcp-backend` tự khởi động cùng Docker và chiếm cổng 5001 — `docker stop fcp-backend` trước khi chạy backend từ source.
- **Redis chết thì `cache.exists` trả `false`**, nên access token đã logout vẫn dùng được cho tới khi hết hạn (≤ 15 phút). Đổi lại, một sự cố Redis không còn đăng xuất toàn bộ người dùng. Lý do đầy đủ ở [`docs/05-redis-rate-limit.md`](../docs/05-redis-rate-limit.md).
- **Gia hạn thuê bao chạy kiểu "lười"** ngay lúc đọc, không có cron. `node-cron` đã bị gỡ khỏi dependency vì không dùng tới.
- **Chỉ có một hàm tính giá** (`calcPrice` trong `booking.service.js`). Hàm thứ hai `calculatePrice` trong `field.service.js` tính sai (lấy giá của giờ bắt đầu cho cả buổi) và đã bị xoá — đừng tạo lại.
- **Thông báo không được làm hỏng hành động gốc.** `notify()` chạy sau khi việc chính đã xong và nuốt mọi lỗi. Đừng đặt nó vào giữa luồng nghiệp vụ, và đừng bỏ `actorId` — thiếu nó là người dùng tự nhận thông báo về chính việc mình vừa làm.
- **`connectRedis()` không được gọi `connect()` vô điều kiện.** `rate-limit-redis` nạp script Lua ngay lúc `require('./app')` và lệnh đó đã tự mở kết nối; gọi lại ném "Redis is already connecting/connected" và server chết lúc khởi động. Đây từng là lỗi thật, chỉ lộ ra khi chạy `node src/server.js` chứ test không bắt được.
- **Token đẩy là `select: false`.** Expo không xác thực người gửi: ai cầm được token là đẩy được thông báo về máy đó. Mọi truy vấn cần nó phải `.select('expoPushTokens')` tường minh.
- **Cờ gom nhóm refresh token phải dọn trong `.finally`.** Dọn trong thân hàm `async` thì nhánh "chưa có refresh token" (chạy hết mà không `await`) bị chính phép gán ghi đè, cờ kẹt lại và app không bao giờ làm mới token nữa. Test bắt được lỗi này chỉ khi các ca chạy chung một file.
- **Sau `fireEvent` trong test RNTL phải `waitFor`.** Không thì test *kế tiếp* trong cùng file mới hỏng, kèm cảnh báo "overlapping act()" rất khó lần ra.
- **Jest backend đặt `maxWorkers: 2`.** Để jest tự chọn theo số nhân CPU thì worker bị giết vì hết RAM ("JavaScript heap out of memory").
