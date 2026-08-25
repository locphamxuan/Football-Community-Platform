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
| POST | `/login` | — | `email, password`. Cả access lẫn refresh token nằm trong cookie `httpOnly` |
| POST | `/refresh-token` | — | Refresh token lấy từ cookie, thiếu thì lấy từ body |
| GET | `/verify-email/:token` | — | |
| POST | `/resend-verification` | — | `email` |
| POST | `/forgot-password` | — | `email`. Luôn trả cùng một thông điệp, kể cả email không tồn tại |
| POST | `/reset-password` | — | `token, password`. Thành công thì huỷ mọi phiên đang đăng nhập |
| POST | `/logout` | 🔒 | Thu hồi access token và xoá mọi phiên |

Các endpoint đăng ký / đăng nhập / quên mật khẩu bị giới hạn bởi `authLimiter`
(mặc định 10 lần / 15 phút, xem [05](05-redis-rate-limit.md)).

**Client gửi header `X-Client: mobile`** thì `/login` và `/refresh-token` trả thêm cả
`accessToken` lẫn `refreshToken` ngay trong `data`, ngoài cookie. App di động không có cookie
jar đáng tin cậy nhưng có Keychain/Keystore để cất token; web không gửi header này nên
**chỉ** nhận cookie — response body của web không chứa token nào, JS trên trang không đọc
được (an toàn hơn trước XSS). Endpoint nào cần đăng nhập thì đọc token theo thứ tự: header
`Authorization: Bearer` trước (mobile), rơi về cookie `accessToken` nếu không có (web).

## Người dùng — `/users`

Toàn bộ nhóm này cần đăng nhập.

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/me` | 🔒 | Hồ sơ đầy đủ của chính mình |
| PATCH | `/me` | 🔒 | `fullName?, phone?, dateOfBirth?, gender?, location?, playerProfile?` |
| PATCH | `/me/password` | 🔒 | `currentPassword, newPassword, confirmPassword` |
| PATCH | `/me/avatar` | 🔒 | `multipart`, field `image`. Thiếu file trả 400 |
| PATCH | `/me/notifications` | 🔒 | `push?` (bool), `mutedTypes?` (mảng `NotificationType`). Trả về `user` |
| POST | `/me/push-tokens` | 🔒 | `token` (dạng `ExponentPushToken[...]`). Đăng ký thiết bị nhận thông báo đẩy; trả `devices` |
| DELETE | `/me/push-tokens` | 🔒 | `token`. Gỡ đúng thiết bị này, các thiết bị khác giữ nguyên |
| GET | `/search` | 🔒 | Query: `q` (≥ 2 ký tự), `limit?` (≤ 20). Tìm người để nhắn tin hoặc mời vào nhóm |
| GET | `/:id` | 🔒 | Hồ sơ công khai của người khác |

`/search` trả hồ sơ rút gọn (`_id, username, fullName, avatar, roles`) và **lọc sẵn** admin,
tài khoản bị khoá và chính người đang tìm — đúng tập người mà `chat.service` sẽ chấp nhận, nên
ô gợi ý không bao giờ đề xuất một người mà bấm vào sẽ nhận 403. Nó đứng **trước** `/:id` trong
router, nếu không Express đọc "search" thành một id.

Token đẩy được lưu thành **mảng** trên `User` (một người có thể vừa dùng điện thoại vừa dùng
máy tính bảng) và mang `select: false` — Expo không xác thực người gửi, ai cầm được token là
đẩy được thông báo về máy đó, nên không endpoint nào được trả nó ra.

Tuỳ chọn thông báo **không** đi qua `PATCH /me` mà có endpoint riêng. Lệnh cập nhật của Mongoose
không làm phẳng object lồng nhau: gửi `{ notifications: { push: false } }` là ghi đè nguyên cụm
`notifications`, cuốn theo cả `mutedTypes`. `PATCH /me/notifications` ghi bằng đường dẫn có dấu
chấm nên gửi thiếu trường nào thì trường đó giữ nguyên. `mutedTypes` gửi lên là **toàn bộ**
danh sách đang tắt, không phải phần thêm bớt — mảng rỗng nghĩa là nhận hết.

## Sân — `/fields`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/` | — | Query: `page, limit, search, city, district, minRating, lat, lng` |
| GET | `/:id` | — | Có cache Redis 10 phút |
| GET | `/:id/availability` | — | Query bắt buộc: `date` (YYYY-MM-DD), `startTime`, `endTime`; tuỳ chọn `fieldType`. Cache 30 giây |
| GET | `/:id/price-quote` | — | Query bắt buộc: `date, startTime, endTime`; tuỳ chọn `promoCode`. Báo giá trước khi đặt, không ghi DB |
| GET | `/owner/my-fields` | 🏟 👑 | Sân của chính chủ sân |
| POST | `/` | 🏟 | `multipart` + JSON fields `location, pricing, operatingHours, amenities, rules`. Qua hạn mức gói |
| PATCH | `/:id` | 🏟 👑 | Như trên, thêm `status` (`active`/`inactive`) và `removeImages` |
| DELETE | `/:id` | 🏟 👑 | Từ chối nếu còn lịch đặt sắp tới |
| POST | `/:id/sub-fields` | 🏟 | `name, fieldType (5v5/7v7/11v11), surface?, capacity (6–22)`. Qua hạn mức gói |
| PATCH | `/:id/sub-fields/:subFieldId` | 🏟 | Thêm `status` (`available`/`maintenance`/`closed`) |
| DELETE | `/:id/sub-fields/:subFieldId` | 🏟 | Từ chối nếu sân con còn lịch |
| POST | `/:id/price-overrides` | 🏟 | `name, startDate, endDate, weekday, weekend` — ghi đè giá cho một khoảng ngày |
| DELETE | `/:id/price-overrides/:overrideId` | 🏟 | |
| POST | `/:id/promotions` | 🏟 | `code, type (percentage/fixed), value, slots?, startDate, endDate, maxUses?` |
| PATCH | `/:id/promotions/:promoId` | 🏟 | Từng phần — dùng để bật/tắt `active` hoặc sửa hạn |
| DELETE | `/:id/promotions/:promoId` | 🏟 | |
| PATCH | `/:id/submit` | 🏟 | Gửi sân đi duyệt; cần ít nhất một sân con |
| PATCH | `/:id/verify` | 👑 | `approve?` (mặc định `true`), `note?` |

## Đặt sân — `/bookings`

Toàn bộ nhóm này cần đăng nhập.

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| POST | `/` | 🔒 | `fieldId, subFieldId, date, startTime, endTime, teamId?, notes?, paymentMethod?, promoCode?` |
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
| POST | `/invoices/:id/report-payment` | 🏟 👑 | `paymentReference` (3–100 ký tự) — đường thủ công |
| POST | `/invoices/:id/checkout` | 🏟 👑 | `provider?` (mặc định `vnpay`) → trả `{ paymentUrl }` |

### Webhook cổng thanh toán — `/webhooks/payments` (nằm ngoài `/api/v1`)

Không JWT — VNPay gọi vào server-to-server (IPN) hoặc redirect trình duyệt người dùng (return).
Chữ ký HMAC là hàng rào chính, không phải cookie/token. Xem
[04 — Quy tắc nghiệp vụ](04-nghiep-vu.md#thanh-toán-online-vnpay) và
[02 — Kiến trúc](02-kien-truc.md#thanh-toán-online-provider-abstraction).

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| GET | `/vnpay/ipn` | Server-to-server, idempotent. Trả JSON `{RspCode, Message}`, luôn HTTP 200 |
| GET | `/vnpay/return` | Redirect trình duyệt về `/owner/billing?payment=success\|failed` — chỉ UX, không xác nhận đơn |

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

`type` nhận đúng tám giá trị dưới đây; giá trị lạ trả 400 chứ không âm thầm trả danh sách rỗng:

| `type` | Bắn khi | Người nhận |
|---|---|---|
| `booking_created` | Có lịch đặt mới | Chủ sân |
| `booking_confirmed` | Chủ sân xác nhận lịch | Người đặt |
| `booking_cancelled` | Lịch bị huỷ | Bên còn lại |
| `match_request_received` | Có lời mời thi đấu | Quản lý đội được mời |
| `match_request_answered` | Lời mời được nhận hoặc từ chối | Người gửi lời mời |
| `match_result_submitted` | Một bên nhập tỉ số | Quản lý đội còn lại |
| `invoice_issued` | Phát hành hoá đơn thuê bao | Chủ sân |
| `invoice_paid` | Cổng thanh toán xác nhận hoá đơn đã trả (IPN) | Chủ sân |
| `chat_message` | Có tin nhắn mới **và** người nhận không có thiết bị nào đang kết nối | Người nhận tin nhắn |

Quy tắc và lý do: [04 — Quy tắc nghiệp vụ](04-nghiep-vu.md#thông-báo-in-app).

## Tin nhắn — `/chat`

Toàn bộ nhóm này cần đăng nhập và **không phân theo vai trò**: chủ sân, quản lý đội và người
chơi đều nhắn tin. Ai được nói chuyện với ai là câu hỏi về quan hệ (có phải hai bên của lịch
đặt này không, có trong nhóm này không), trả lời trong `chat.service` chứ không phải bằng
`authorize(...)` ở route.

Ngoại lệ duy nhất đi ngược chiều: **quản trị viên nền tảng bị chặn ở cửa** (`denyRoles(admin)`
trên cả router lẫn lúc bắt tay WebSocket). Họ xử lý khiếu nại bằng công cụ quản trị; một kênh
riêng với admin trong app là kênh không ai kiểm được.

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/conversations` | 🔒 | Query: `page, limit, contextType, type`. Trả `conversations`, `unreadCount` và `meta.pagination` trong một lần gọi |
| POST | `/conversations` | 🔒 | `recipientId`, `contextType?`, `contextRef?`. Mở hội thoại hoặc trả lại cái đã có — gọi lại không tạo luồng thứ hai |
| GET | `/unread-count` | 🔒 | Tổng chưa đọc của mọi hội thoại, cho chấm đỏ |
| GET | `/conversations/:id` | 🔒 | Một hội thoại kèm danh sách thành viên và vai trò của họ |
| GET | `/conversations/:id/messages` | 🔒 | Query: `page, limit`. Mới nhất trước |
| POST | `/conversations/:id/messages` | 🔒 | `body` (1–2000 ký tự, cắt khoảng trắng trước khi đo) |
| POST | `/conversations/:id/read` | 🔒 | Đặt mốc đã đọc, xoá số chưa đọc, báo "đã xem" cho người kia |

### Nhóm

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| POST | `/groups` | 🔒 | `name` (1–100), `memberIds` (≥ 1). Người tạo là quản trị nhóm đầu tiên |
| PATCH | `/conversations/:id` | 🔒 quản trị nhóm | `name` |
| POST | `/conversations/:id/members` | 🔒 quản trị nhóm | `memberIds` |
| DELETE | `/conversations/:id/members/:memberId` | 🔒 quản trị nhóm | Tự gỡ mình trả **400** — dùng `/leave` |
| POST | `/conversations/:id/leave` | 🔒 thành viên | Trả `{ conversationId, deleted }`; `deleted: true` khi người cuối cùng rời đi |

Trần **50 thành viên** mỗi nhóm (`GROUP_MAX_PARTICIPANTS`); vượt trả **400**. Không phải quản
trị nhóm mà gọi bốn endpoint đầu trả **403**; gọi chúng trên hội thoại tay đôi trả **400**.
Quy tắc và lý do: [04 — Tin nhắn](04-nghiep-vu.md#tin-nhắn).

Mỗi thay đổi nhóm ghi thêm một tin nhắn `kind: 'system'` vào chính dòng thời gian ấy ("A đã
thêm B vào nhóm"), nên client chỉ cần vẽ nó khác đi chứ không phải tải một nhật ký riêng.

`contextType` nhận bốn giá trị, và mỗi giá trị có một luật riêng về **ai được mở hội thoại**:

| `contextType` | `contextRef` trỏ tới | Hai bên hợp lệ |
|---|---|---|
| `direct` | — | Mọi tài khoản đang hoạt động |
| `booking` | `Booking` | Người đặt ↔ chủ sân của đúng lịch đặt đó |
| `match_request` | `MatchRequest` | Quản lý hai đội trong lời mời |
| `field` | `Field` | Bất kỳ ai ↔ chủ của đúng sân đó |

Không phải hai bên hợp lệ thì trả **403**, và người ngoài một hội thoại đọc hay gửi cũng trả
403. Ngữ cảnh khác `direct` mà thiếu `contextRef` trả **400**. Vượt trần tần suất (mặc định
30 tin/phút cho mỗi tài khoản) trả **429** — trần này áp cho cả WebSocket, xem dưới.

### WebSocket

Gắn vào cùng cổng với REST. Mobile gửi token qua `handshake.auth.token` (không phải header):

```js
io('http://localhost:5001', { auth: { token: accessToken } });
```

Web không gửi `auth` gì cả — access token nằm trong cookie `httpOnly`, trình duyệt tự đính
kèm ở request bắt tay khi bật `withCredentials: true`:

```js
io('http://localhost:5001', { withCredentials: true });
```

Bắt tay thất bại (thiếu token, token hỏng, token đã logout) thì kết nối bị từ chối ngay.

| Chiều | Sự kiện | Payload |
|---|---|---|
| ↑ client | `message:send` | `{ conversationId, body }` |
| ↑ client | `conversation:read` | `{ conversationId }` |
| ↑ client | `conversation:typing` | `{ conversationId, isTyping? }` (mặc định `true`) |
| ↓ server | `message:new` | `{ conversationId, message }` — gửi cho **mọi** thành viên, kể cả người gửi (thiết bị khác của họ) |
| ↓ server | `conversation:read` | `{ conversationId, userId, readAt }` — chỉ gửi cho những người còn lại |
| ↓ server | `conversation:typing` | `{ conversationId, userId, isTyping }` |
| ↓ server | `conversation:updated` | `{ conversation }` — nhóm vừa lập, đổi tên, hoặc đổi thành viên |
| ↓ server | `chat:error` | `{ message, code }` |

`conversation:updated` cũng gửi tới **người vừa bị gỡ**: họ sẽ không thấy mình trong
`participants`, và đó chính là dấu hiệu để client bỏ nhóm khỏi hộp thư thay vì để nó nằm lại
tới lần tải trang sau.

Mỗi sự kiện client gửi lên đều trả lời qua callback `ack`:
`{ success: true, data }` hoặc `{ success: false, message, code }`. `chat:error` là bản sao
cho client không dùng ack — lỗi ở đây **không** đóng kết nối.

Người gửi được lấy từ token, không bao giờ từ payload: client tự khai `senderId` thì trường
đó bị bỏ qua hoàn toàn. Payload đi qua đúng schema Zod mà route REST dùng, nên WebSocket không
phải là cửa sau đi vòng qua ràng buộc nào.

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
| GET | `/audit-log` | Query: `page, limit, adminId, action` — xem [02-kien-truc.md](02-kien-truc.md) |

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
| `PROMO_CODE_INVALID` | 400 | Mã khuyến mãi không tồn tại, chưa active, hết hạn hoặc hết lượt dùng |
| `DUPLICATE_PROMO_CODE` | 400 | Sân đã có mã này đang active |
| `PRICE_OVERRIDE_NOT_FOUND` | 404 | Không có ghi đè giá với id đó |
| `PROMOTION_NOT_FOUND` | 404 | Không có mã khuyến mãi với id đó |
| `INVOICE_NOT_PAYABLE` | 400 | Hoá đơn đã thanh toán hoặc đã huỷ |
| `PAYMENT_PROVIDER_UNAVAILABLE` | 503 | Cổng thanh toán chưa cấu hình (thiếu `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET`) — chỉ xảy ra ở `POST /billing/invoices/:id/checkout` |
| `EMAIL_ALREADY_EXISTS` / `USERNAME_ALREADY_EXISTS` | 409 | Đăng ký trùng |
| `RESET_TOKEN_INVALID` | 400 | Token đặt lại mật khẩu sai hoặc hết hạn |
| `TOO_MANY_REQUESTS` | 429 | Vượt rate limit |
| `INTERNAL_ERROR` | 500 | Lỗi không lường trước; chi tiết chỉ nằm trong log server |
