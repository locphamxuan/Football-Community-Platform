# Bối cảnh dự án

> Cập nhật lần cuối: 2026-08-10

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

## Đang làm / còn dở

- `mobile/` mới có màn hình bảng giá thuê bao để chứng minh app đọc đúng hợp đồng API. **Bước tiếp theo:** điều hướng (expo-router), màn đăng nhập + lưu token, rồi màn tìm sân.
- Chưa mở PR cho hai nhánh `feature/role-dashboards-and-billing` và `chore/testing-and-mobile-workspace`.

## Việc nên làm tiếp

- Thanh toán đặt sân trực tuyến (hiện chỉ có tiền mặt / chuyển khoản ghi nhận thủ công).
- Thông báo đẩy cho mobile khi có lời mời thi đấu hoặc lịch đặt được xác nhận.
- Job tự phát hành hoá đơn thuê bao hàng tháng (`node-cron` đã có trong dependency nhưng chưa dùng).

## Quyết định và bẫy cần nhớ

- **Doanh thu nền tảng ≠ tiền đặt sân.** Tiền khách trả cho chủ sân là GMV, doanh thu nền tảng chỉ là hoá đơn thuê bao. Đừng gộp hai con số này ở bất kỳ dashboard nào.
- **Backend là JavaScript thuần**, không TypeScript — theo yêu cầu ban đầu của chủ dự án.
- **Form gửi kèm ảnh đi qua multipart/form-data**, nên mọi field tới backend đều là chuỗi. Schema Zod cho các form này phải dùng `z.coerce` hoặc helper `booleanish`, nếu không `z.number()`/`z.boolean()` luôn fail.
- **Sidebar phải là client component.** Chúng truyền icon lucide (function) cho `SidebarNav`; server component không serialize được function nên build sẽ vỡ lúc prerender.
- **`shared/types.ts` chỉ chứa type.** Thêm giá trị runtime vào đó là phải cấu hình thêm cho cả Next.js lẫn Metro.
- **RNTL 14 có `render()` bất đồng bộ.** Quên `await` thì `screen` rỗng và lỗi báo rất khó hiểu ("render function has not been called").
- Cổng: backend 5001, frontend 3001. Container `fcp-backend` tự khởi động cùng Docker và chiếm cổng 5001 — `docker stop fcp-backend` trước khi chạy backend từ source.
