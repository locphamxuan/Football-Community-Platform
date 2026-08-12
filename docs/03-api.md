# 03 — Tham chiếu API

Gốc: `/api/v1`. Mọi response theo khuôn dạng chung ở [02 — Kiến trúc](02-kien-truc.md#khuôn-dạng-response).

Cột **Quyền**:

| Ký hiệu | Nghĩa |
|---|---|
| — | Công khai, không cần token |
| 🔒 | Cần đăng nhập |
| 🏟 | `field_owner` |
| 👑 | `admin` |

Cột **Body** ghi `multipart` nghĩa là endpoint nhận `multipart/form-data`; các field dạng
object/array phải gửi dưới dạng chuỗi JSON (xem `parseJsonFields`).

---

## Hệ thống

| Method | Đường dẫn | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/health` | — | Nằm ngoài `/api` nên không bị rate limit. Trả `status`, `env`, `redis`, `timestamp` |

## Auth — `/auth`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| POST | `/register` | — | `email, password, username, fullName, phone?`. Mật khẩu ≥ 8 ký tự, có chữ hoa và số |
| POST | `/login` | — | `email, password`. Trả `accessToken`; refresh token nằm trong cookie `httpOnly` |
| POST | `/refresh-token` | — | Token lấy từ cookie, thiếu thì lấy từ body |
| GET | `/verify-email/:token` | — | |
| POST | `/resend-verification` | — | `email` |
| POST | `/forgot-password` | — | `email`. Luôn trả cùng một thông điệp, kể cả email không tồn tại |
| POST | `/reset-password` | — | `token, password`. Thành công thì huỷ mọi phiên đang đăng nhập |
| POST | `/logout` | 🔒 | Thu hồi access token và xoá mọi phiên |

Các endpoint đăng ký / đăng nhập / quên mật khẩu bị giới hạn bởi `authLimiter`
(mặc định 10 lần / 15 phút, xem [05](05-redis-rate-limit.md)).

**Client gửi header `X-Client: mobile`** thì `/login` và `/refresh-token` trả thêm
`refreshToken` ngay trong `data`, ngoài cookie. App di động không có cookie jar đáng tin cậy
nhưng có Keychain/Keystore để cất token; web không gửi header này nên vẫn chỉ nhận cookie.

## Người dùng — `/users`

Toàn bộ nhóm này cần đăng nhập.

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/me` | 🔒 | Hồ sơ đầy đủ của chính mình |
| PATCH | `/me` | 🔒 | `fullName?, phone?, dateOfBirth?, gender?, location?, playerProfile?, notifications?` |
| PATCH | `/me/password` | 🔒 | `currentPassword, newPassword, confirmPassword` |
| PATCH | `/me/avatar` | 🔒 | `multipart`, field `image`. Thiếu file trả 400 |
| POST | `/me/push-tokens` | 🔒 | `token` (dạng `ExponentPushToken[...]`). Đăng ký thiết bị nhận thông báo đẩy; trả `devices` |
| DELETE | `/me/push-tokens` | 🔒 | `token`. Gỡ đúng thiết bị này, các thiết bị khác giữ nguyên |
| GET | `/:id` | 🔒 | Hồ sơ công khai của người khác |

Token đẩy được lưu thành **mảng** trên `User` (một người có thể vừa dùng điện thoại vừa dùng
máy tính bảng) và mang `select: false` — Expo không xác thực người gửi, ai cầm được token là
đẩy được thông báo về máy đó, nên không endpoint nào được trả nó ra.

## Sân — `/fields`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/` | — | Query: `page, limit, search, city, district, minRating, lat, lng` |
| GET | `/:id` | — | Có cache Redis 10 phút |
| GET | `/:id/availability` | — | Query bắt buộc: `date` (YYYY-MM-DD), `startTime`, `endTime`; tuỳ chọn `fieldType`. Cache 30 giây |
| GET | `/owner/my-fields` | 🏟 👑 | Sân của chính chủ sân |
| POST | `/` | 🏟 | `multipart` + JSON fields `location, pricing, operatingHours, amenities, rules`. Qua hạn mức gói |
| PATCH | `/:id` | 🏟 👑 | Như trên, thêm `status` (`active`/`inactive`) và `removeImages` |
| DELETE | `/:id` | 🏟 👑 | Từ chối nếu còn lịch đặt sắp tới |
| POST | `/:id/sub-fields` | 🏟 | `name, fieldType (5v5/7v7/11v11), surface?, capacity (6–22)`. Qua hạn mức gói |
| PATCH | `/:id/sub-fields/:subFieldId` | 🏟 | Thêm `status` (`available`/`maintenance`/`closed`) |
| DELETE | `/:id/sub-fields/:subFieldId` | 🏟 | Từ chối nếu sân con còn lịch |
| PATCH | `/:id/submit` | 🏟 | Gửi sân đi duyệt; cần ít nhất một sân con |
| PATCH | `/:id/verify` | 👑 | `approve?` (mặc định `true`), `note?` |

## Đặt sân — `/bookings`

Toàn bộ nhóm này cần đăng nhập.

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| POST | `/` | 🔒 | `fieldId, subFieldId, date, startTime, endTime, teamId?, notes?, paymentMethod?` |
| GET | `/my-bookings` | 🔒 | Query: `page, limit, status, startDate, endDate` |
| GET | `/team/bookings` | 🔒 | Lịch của các đội mình dẫn dắt. Query thêm `teamId` |
| GET | `/:id` | 🔒 | Người đặt, chủ sân hoặc admin |
| PATCH | `/:id/cancel` | 🔒 | `reason` bắt buộc. Người đặt phải huỷ trước giờ đá 2 tiếng |
| GET | `/owner/bookings` | 🏟 👑 | Lịch trên mọi sân của chủ sân. Query thêm `fieldId` |
| GET | `/owner/stats` | 🏟 👑 | Số liệu tổng quan dashboard |
| GET | `/owner/revenue` | 🏟 👑 | Query `months` (1–24, mặc định 6) |
| GET | `/field/:fieldId` | 🏟 👑 | Lịch của một sân |
| PATCH | `/:id/confirm` | 🏟 👑 | Chỉ đơn `pending` |
| PATCH | `/:id/complete` | 🏟 👑 | Chỉ đơn `confirmed` và đã qua giờ bắt đầu |
| PATCH | `/:id/no-show` | 🏟 👑 | Như trên |

> Các đường dẫn cố định (`/my-bookings`, `/team/bookings`, `/owner/*`, `/field/*`) được khai
> báo **trước** `/:id`, nếu không Express sẽ hiểu `team` là một `id`.

## Đội bóng — `/teams`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/` | — | Query: `page, limit, search, city, skillLevel, fieldSize, sort` |
| GET | `/:id` | — | |
| GET | `/me/my-teams` | 🔒 | Đội mình tham gia hoặc dẫn dắt |
| GET | `/me/dashboard` | 🔒 | Tổng quan cho quản lý đội |
| POST | `/` | 🔒 | `multipart` (logo qua field `image`). `name, description?, homeCity?, skillLevel?, fieldSize?, maxMembers?, isPublic?, tags?` |
| PATCH | `/:id` | 🔒 | Chỉ quản lý đội |
| DELETE | `/:id` | 🔒 | Giải thể đội |
| POST | `/:id/join` | 🔒 | `inviteCode` |
| POST | `/:id/leave` | 🔒 | Quản lý phải chuyển quyền trước |
| DELETE | `/:id/members/:memberId` | 🔒 | Chỉ quản lý |
| PATCH | `/:id/members/:memberId` | 🔒 | `role? (captain/player), position?, status?` |
| POST | `/:id/transfer-management` | 🔒 | `newManagerId` — phải là thành viên đang hoạt động |
| POST | `/:id/invite-code/regenerate` | 🔒 | Chỉ quản lý |

## Thách đấu — `/match-requests`

Toàn bộ nhóm này cần đăng nhập.

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| POST | `/` | 🔒 | `requesterTeamId, opponentTeamId, date, startTime, endTime, fieldSize, fieldId?, message?` |
| GET | `/` | 🔒 | Query: `page, limit, status, teamId` |
| GET | `/:id` | 🔒 | |
| PATCH | `/:id/respond` | 🔒 | `accept` (boolean thật, không nhận chuỗi). Chỉ quản lý/đội trưởng đội được mời |
| PATCH | `/:id/cancel` | 🔒 | Chỉ người gửi, chỉ khi còn `pending` |
| PATCH | `/:id/result` | 🔒 | `requesterScore, opponentScore` (0–99). Cần cả hai bên xác nhận mới tính Elo |

## Đánh giá — `/reviews`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/field/:fieldId` | — | Query: `page, limit, rating` |
| GET | `/me` | 🔒 | Đánh giá mình đã viết |
| POST | `/` | 🔒 | `multipart` (tối đa 4 ảnh qua `images`). `fieldId, rating (1–5), comment?, bookingId?`. Phải đã hoàn thành một lượt đặt tại sân |
| PATCH | `/:id` | 🔒 | Chỉ người viết |
| DELETE | `/:id` | 🔒 👑 | Người viết hoặc admin |
| POST | `/:id/like` | 🔒 | Bấm lại để bỏ thích |
| POST | `/:id/reply` | 🏟 | `comment`. Chỉ chủ của sân được đánh giá |
| GET | `/owner/reviews` | 🏟 👑 | Hộp thư đánh giá, kèm số chưa trả lời |

## Thuê bao — `/billing`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/plans` | — | Bảng giá ba gói |
| GET | `/subscription` | 🏟 👑 | Thuê bao, hạn mức đang dùng, công nợ |
| PATCH | `/subscription/plan` | 🏟 👑 | `plan` (`free`/`basic`/`pro`) |
| PATCH | `/subscription/auto-renew` | 🏟 👑 | `autoRenew` (boolean) |
| GET | `/invoices` | 🏟 👑 | Query: `page, limit, status` |
| POST | `/invoices/:id/report-payment` | 🏟 👑 | `paymentReference` (3–100 ký tự) |

## Thông báo — `/notifications`

Toàn bộ nhóm này cần đăng nhập. Hộp thư là của riêng từng người, không phân vai trò:
mọi truy vấn đều bị chặn cứng bằng `recipient = người gọi`, nên không có endpoint nào
đọc được thông báo của người khác.

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/` | 🔒 | Query: `page, limit, unread` (`'true'`/`'false'`), `type`. Trả `notifications`, `unreadCount` và `meta.pagination` trong một lần gọi |
| GET | `/unread-count` | 🔒 | Chỉ số chưa đọc; đọc từ Redis nếu còn hạn |
| PATCH | `/read-all` | 🔒 | Đánh dấu toàn bộ đã đọc, trả `modified` |
| PATCH | `/:id/read` | 🔒 | Idempotent. Thông báo của người khác trả 404 chứ không phải 403 — không xác nhận là nó tồn tại |

`type` nhận đúng bảy giá trị dưới đây; giá trị lạ trả 400 chứ không âm thầm trả danh sách rỗng:

| `type` | Bắn khi | Người nhận |
|---|---|---|
| `booking_created` | Có lịch đặt mới | Chủ sân |
| `booking_confirmed` | Chủ sân xác nhận lịch | Người đặt |
| `booking_cancelled` | Lịch bị huỷ | Bên còn lại |
| `match_request_received` | Có lời mời thi đấu | Quản lý đội được mời |
| `match_request_answered` | Lời mời được nhận hoặc từ chối | Người gửi lời mời |
| `match_result_submitted` | Một bên nhập tỉ số | Quản lý đội còn lại |
| `invoice_issued` | Phát hành hoá đơn thuê bao | Chủ sân |

Quy tắc và lý do: [04 — Quy tắc nghiệp vụ](04-nghiep-vu.md#thông-báo-in-app).

## Quản trị — `/admin`

Toàn bộ nhóm này chỉ dành cho 👑.

| Method | Đường dẫn | Body / Ghi chú |
|---|---|---|
| GET | `/overview` | Toàn cảnh nền tảng |
| GET | `/revenue` | Query `months` (1–24) |
| GET | `/owners` | Query: `page, limit, search, plan` |
| GET | `/owners/:id` | Chi tiết một chủ sân |
| GET | `/users` | Query: `page, limit, search, role, status, city` |
| PATCH | `/users/:id` | `status?` và/hoặc `roles?` — phải có ít nhất một |
| GET | `/fields` | Query: `page, limit, search, status, verified` |
| GET | `/invoices` | Query: `page, limit, status, ownerId` |
| PATCH | `/invoices/:id/confirm` | Xác nhận đã nhận tiền |
| PATCH | `/invoices/:id/void` | `reason?` (≤ 300 ký tự) |

---

## Mã lỗi

Client phân nhánh theo `code`, không theo `message`.

| Code | HTTP | Khi nào |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod từ chối dữ liệu vào; chi tiết nằm ở `errors` theo từng field |
| `INVALID_CREDENTIALS` | 401 | Sai email hoặc mật khẩu (cùng một thông điệp cho cả hai) |
| `UNAUTHORIZED` | 401 | Thiếu hoặc sai header `Authorization` |
| `TOKEN_INVALID` | 401 | Access token hỏng, hết hạn hoặc đã bị thu hồi |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token sai, hết hạn, hoặc bị dùng lại |
| `EMAIL_NOT_VERIFIED` | 403 | Chưa xác minh email |
| `ACCOUNT_BANNED` | 403 | Tài khoản bị khoá |
| `FORBIDDEN` | 403 | Không đủ vai trò, hoặc không phải chủ sở hữu tài nguyên |
| `PLAN_LIMIT_REACHED` | 402 | Vượt hạn mức gói thuê bao |
| `SUBSCRIPTION_PAST_DUE` | 402 | Còn hoá đơn chưa thanh toán |
| `NOT_FOUND` | 404 | Không có tài nguyên |
| `SUBFIELD_NOT_FOUND` | 404 | Không có sân con |
| `CONFLICT` | 409 | Trùng dữ liệu hoặc trạng thái không cho phép |
| `SLOT_NOT_AVAILABLE` | 400 / 409 | Khung giờ đã có người đặt, ngoài giờ mở cửa, hoặc đã trôi qua |
| `BOOKING_NOT_CANCELLABLE` | 400 | Sai trạng thái, hoặc đã quá hạn huỷ |
| `FIELD_NOT_ACTIVE` | 400 | Sân đang tắt nhận đặt |
| `FIELD_NOT_VERIFIED` | 400 | Sân chưa được admin duyệt |
| `INVOICE_NOT_PAYABLE` | 400 | Hoá đơn đã thanh toán hoặc đã huỷ |
| `EMAIL_ALREADY_EXISTS` / `USERNAME_ALREADY_EXISTS` | 409 | Đăng ký trùng |
| `RESET_TOKEN_INVALID` | 400 | Token đặt lại mật khẩu sai hoặc hết hạn |
| `TOO_MANY_REQUESTS` | 429 | Vượt rate limit |
| `INTERNAL_ERROR` | 500 | Lỗi không lường trước; chi tiết chỉ nằm trong log server |
