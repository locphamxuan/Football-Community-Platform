# 02 — Kiến trúc

## Một repo, bốn thư mục

```
backend/    API Express + Mongoose (JavaScript thuần)
frontend/   Web Next.js 16 App Router (TypeScript)
mobile/     App Expo / React Native (TypeScript)
shared/     Hợp đồng API — chỉ có type, không có giá trị runtime
docs/       Tài liệu này
memory/     PROGRESS.md — trạng thái dự án
```

Chọn monorepo vì hợp đồng API là thứ hay vỡ nhất khi web và mobile nằm ở hai repo:
đổi response backend mà quên đổi mobile thì không ai biết cho tới lúc chạy thật.

### `shared/types.ts` chỉ chứa type

Web và mobile import `@fcp/shared`. Vì file chỉ có `type`/`interface`, TypeScript xoá sạch
import lúc biên dịch — Next.js lẫn Metro không cần cấu hình gì thêm. Thêm một giá trị
runtime vào đó (hằng số, hàm, enum) là phải cấu hình transpile cho cả hai bundler.

Khi response backend đổi: **sửa `shared/types.ts` trước**. Cả web lẫn mobile sẽ fail
type-check cho tới khi được cập nhật — đó chính là tác dụng.

## Backend: một request đi qua đâu

```
request
  → helmet, cors                     bảo mật header, chặn origin lạ
  → express.json / urlencoded        parse body
  → cookieParser                     đọc refreshToken từ cookie
  → mongoSanitize                    chặn NoSQL injection
  → morgan                           log (tắt trong test)
  → globalLimiter, writeLimiter      trần request chung + trần riêng cho ghi
  → router /api/v1
      → authenticate                 xác thực JWT, kiểm tra token bị thu hồi
      → authorize(...roles)          chặn theo vai trò
      → uploadLimiter + multer       nhận ảnh vào RAM
      → parseJsonFields              giải mã field JSON của multipart
      → validate(schema)             Zod: ép kiểu, loại field lạ, gom lỗi
      → controller                   mỏng: lấy tham số, gọi service, trả response
          → service                  toàn bộ quy tắc nghiệp vụ
              → model (Mongoose)     truy cập dữ liệu
  → errorHandler                     biến mọi lỗi thành một khuôn dạng JSON
```

### Phân vai từng tầng

| Tầng | Chịu trách nhiệm | **Không** chứa |
|---|---|---|
| `routes/` | Khai báo đường dẫn và chuỗi middleware | Logic |
| `controllers/` | Đọc `req`, gọi service, gọi `sendSuccess` | Quy tắc nghiệp vụ, truy vấn DB |
| `services/` | Quy tắc nghiệp vụ, ném `AppError` | `req`/`res` |
| `models/` | Schema và index | Quy tắc nghiệp vụ nhiều bước |
| `validations/` | Hợp đồng dữ liệu vào (Zod) | Truy vấn DB |

Controller không được biết `res` là gì ngoài việc chuyển tiếp — nhờ vậy toàn bộ service
kiểm thử được mà không cần HTTP.

## Khuôn dạng response

Mọi endpoint trả về cùng một dạng, kể cả khi lỗi:

```jsonc
// Thành công
{ "success": true, "message": "...", "data": { ... }, "meta": { "pagination": { ... } } }

// Lỗi
{ "success": false, "message": "...", "code": "SLOT_NOT_AVAILABLE", "errors": { "date": ["..."] } }
```

Client phân nhánh theo `code` ([danh sách](03-api.md#mã-lỗi)), **không** theo `message` —
message là để hiển thị cho người dùng và có thể đổi bất cứ lúc nào.

## Xác thực

- **Access token** (JWT, mặc định 15 phút) mang `sub`, `email`, `roles`, `jti`. Gửi qua header `Authorization: Bearer`.
- **Refresh token** (JWT, mặc định 7 ngày) chỉ mang `sub` và `jti`. Nằm trong cookie `httpOnly`, path `/api/v1/auth`.
- Refresh token được **băm trước khi lưu**; mỗi lần refresh thì xoay token. Dùng lại một
  token đã xoay = dấu hiệu bị đánh cắp → hệ thống xoá sạch mọi phiên của user đó.
- Logout đưa `jti` của access token vào danh sách thu hồi trên Redis cho tới khi token hết hạn.
- Mỗi tài khoản giữ tối đa **5 phiên** gần nhất.

## Mobile: một màn hình đi qua đâu

```
app/                    expo-router — file nào cũng là một route
  _layout.tsx           SafeArea → React Query → AuthProvider → Stack
  (tabs)/               5 tab: tìm sân, lịch đặt, đội bóng, thông báo, hồ sơ
  (auth)/               đăng nhập, đăng ký, quên mật khẩu
src/services/           một facade cho mỗi nhóm endpoint, trả type của @fcp/shared
src/lib/authFetch.ts    gọi API kèm access token, tự làm mới khi 401
src/lib/session.ts      nơi duy nhất giữ token (Keychain/Keystore + bản sao trong RAM)
src/lib/push.ts         xin quyền và lấy Expo push token
src/components/         Screen, Button, TextField, Badge, Loading, EmptyState, ErrorState
```

Điều hướng theo file (`expo-router`) chứ không khai báo tay như React Navigation: cấu trúc
thư mục chính là sơ đồ màn hình, và deep link từ thông báo đẩy chỉ là một đường dẫn.

**Không chặn người chưa đăng nhập ở cửa vào.** Tìm sân, xem chi tiết sân và đọc đánh giá là
công khai; màn nào cần phiên thì bọc `RequireAuth` và mời đăng nhập ngay tại chỗ. Bắt đăng
nhập trước khi cho xem gì cả là cách nhanh nhất để mất người dùng mới.

**Token nằm trong Keychain/Keystore, không phải AsyncStorage** — AsyncStorage là file thường,
đọc được trên máy đã root hoặc qua bản sao lưu.

## Những quyết định đáng nhớ

- **Backend là JavaScript thuần**, không TypeScript — theo yêu cầu ban đầu của chủ dự án.
  Hợp đồng API vẫn được ràng buộc kiểu ở phía client qua `shared/types.ts`.
- **Ngày lưu bằng UTC.** Booking lưu `new Date('YYYY-MM-DD')` = nửa đêm UTC, nên mọi truy
  vấn theo ngày phải cắt mốc bằng `Date.UTC`. Dùng giờ địa phương sẽ lệch ngày trên server
  khác múi giờ.
- **Sân con là sub-document nhúng trong `Field`**, không phải collection riêng. Đọc sân là
  có luôn sân con, nhưng đổi lại không `populate` được — chỗ nào cần tên sân con thì phải
  tự ghép (xem `getOwnerBookings`).
- **Gia hạn thuê bao kiểu "lười"**: kiểm tra và gia hạn ngay lúc đọc thuê bao, thay vì chạy
  cron hàng tháng. Không cần job nền, và không bao giờ phát hành trùng hoá đơn.
- **Ảnh đi qua multipart/form-data**, nên mọi field tới backend đều là chuỗi. Schema Zod cho
  các form đó phải dùng `z.coerce` hoặc helper `booleanish`.
- **Thông báo là hệ quả, không phải điều kiện.** `notify()` được gọi *sau* khi hành động đã
  thành công và nuốt mọi lỗi. Một lần ghi thông báo hỏng không được cuộn ngược việc đã làm xong.
- **Mobile gom mọi lần làm mới token vào một promise.** Mở app là hàng loạt request cùng nhận
  401; mỗi request tự gọi `/auth/refresh-token` thì backend coi các lần sau là token dùng lại
  và huỷ sạch phiên. Cờ gom nhóm phải được dọn trong `.finally` chứ **không** trong thân hàm
  `async`: nhánh "chưa có refresh token" chạy hết mà không hề `await`, nên phép gán cờ xảy ra
  *sau* lúc dọn và ghi đè lại — cờ kẹt vĩnh viễn và từ đó không lần nào làm mới được nữa.
- **`connectRedis()` phải chịu được client đã kết nối sẵn.** `rate-limit-redis` nạp script Lua
  ngay khi middleware được tạo — tức là lúc `require('./app')`, trước khi `server.js` gọi
  `connectRedis()` — và lệnh đầu tiên đó đã tự mở kết nối. Gọi `connect()` lần nữa ném
  "Redis is already connecting/connected" và server chết ngay lúc khởi động.
