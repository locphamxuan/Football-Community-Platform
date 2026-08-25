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

- **Access token** (JWT, mặc định 15 phút) mang `sub`, `email`, `roles`, `jti`.
- **Refresh token** (JWT, mặc định 7 ngày) chỉ mang `sub` và `jti`.
- **Web nhận cả hai token qua cookie `httpOnly`** — `accessToken` (path `/api/v1`) và
  `refreshToken` (path `/api/v1/auth`) — chứ không phải trong response body. JS trên trang
  không đọc/ghi được cookie `httpOnly`, nên bị XSS cũng không lấy được token nào ra khỏi
  trình duyệt. `authenticate` và `authenticateSocket` đọc token theo thứ tự: header
  `Authorization: Bearer` trước (mobile), rơi về cookie `accessToken` nếu không có (web).
- **Mobile tự khai bằng header `X-Client: mobile`** để nhận cả hai token trong response body
  và tự cất vào Keychain/Keystore — app không có cookie jar đáng tin cậy để dựa vào, nhưng có
  chỗ cất tương đương. Cookie vẫn được set song song cho request đó (không dùng tới), không
  phía nào bị hạ mức bảo vệ vì phía kia. Xem `wantsTokenInBody` trong `auth.controller.js`.
- Refresh token được **băm trước khi lưu**; mỗi lần refresh thì xoay token. Dùng lại một
  token đã xoay = dấu hiệu bị đánh cắp → hệ thống xoá sạch mọi phiên của user đó.
- Logout đưa `jti` của access token vào danh sách thu hồi trên Redis, **TTL lấy từ `exp` của
  chính token đó** chứ không phải một hằng số: TTL cứng 15 phút sẽ ngắn hơn token ngay khi
  `JWT_ACCESS_EXPIRES_IN` được đặt dài hơn, và token đã đăng xuất sống lại trong khoảng chênh.
- Mỗi tài khoản giữ tối đa **5 phiên** gần nhất.
- **CSRF**: cả hai cookie đặt `SameSite=Strict` — trình duyệt không gửi kèm chúng cho bất kỳ
  request nào bắt nguồn từ một trang khác, kể cả `fetch` có `credentials: include`. Đây là
  lớp phòng thủ CSRF duy nhất hiện có (chưa có CSRF token riêng); đủ cho một origin web duy
  nhất gọi API của chính nó, nhưng cần xem lại nếu sau này có domain thứ hai cần gọi API
  bằng cookie.

## Realtime: một tin nhắn đi qua đâu

WebSocket (socket.io) gắn vào **đúng HTTP server đang phục vụ REST**, không mở cổng riêng —
một cổng, một chứng chỉ TLS, một dòng cấu hình proxy.

```
kết nối
  → authenticateSocket           xác thực JWT lấy từ handshake.auth.token
  → socket.join('user:<id>')     mỗi người một phòng, mọi thiết bị của họ vào chung
  → registerHandlers             message:send, conversation:read, conversation:typing
      → chat.service             cùng service mà route REST gọi
          → model                lưu trước
          → emitter.emitToUsers  rồi mới đẩy
```

```
backend/src/socket/
  index.js      dựng io, gắn redis adapter, nối auth + handlers
  auth.js       chặn cửa lúc bắt tay
  handlers.js   sự kiện → service; mọi lỗi trả về qua ack, không giết tiến trình
  emitter.js    cửa duy nhất để service đẩy realtime
  events.js     tên sự kiện, khớp với shared/types.ts
```

Bốn quyết định đáng nhớ ở tầng này:

- **Phòng theo người, không theo hội thoại.** Người đang ở màn hình khác vẫn phải thấy chấm đỏ
  khi có tin mới, mà phòng theo hội thoại chỉ tới được người đang mở đúng hội thoại ấy. Phòng
  theo người cũng bỏ luôn một bước phải kiểm quyền lúc `join`.
- **`emitter.js` tồn tại để cắt vòng require.** Tầng socket require service để xử lý sự kiện;
  service require `emitter` chứ không require ngược lại tầng socket, nếu không một trong hai
  module nhận về object rỗng. Chưa có `io` (test, hoặc tiến trình chỉ chạy REST) thì `emitter`
  im lặng không làm gì.
- **Redis adapter là bắt buộc chứ không phải tối ưu.** Bộ nhớ trong của socket.io chỉ biết
  kết nối của chính tiến trình nó; chạy hai instance sau load balancer mà thiếu adapter thì hai
  người ngồi trên hai instance khác nhau không nhận được tin của nhau — và lỗi chỉ lộ ra ở
  production. `createSocketServer` phải chạy **sau** `connectRedis()`: adapter nhân bản client
  Redis, mà nhân bản một client chưa từng kết nối thì bản sao cũng không có kết nối.
- **Xác thực một lần lúc bắt tay.** Kết nối sống lâu hơn access token, nên một phiên đã mở vẫn
  chạy tiếp tới khi client ngắt. Client tự kết nối lại bằng token mới sau mỗi lần refresh; ai
  bị logout thì lần bắt tay sau bị chặn. Mobile gửi token qua `handshake.auth` — trình duyệt
  không cho đặt header tuỳ ý trên kết nối WebSocket, nên header chỉ tới được server ở giai
  đoạn polling rồi biến mất đúng lúc client nâng cấp lên WebSocket, còn `auth` thì socket.io
  gửi lại nguyên vẹn ở mọi transport. Web không có token nào ở phía JS để đặt vào `auth` —
  access token nằm trong cookie `httpOnly`, và cookie thì trình duyệt tự đính kèm ở request
  bắt tay (`withCredentials`); `authenticateSocket` thử `handshake.auth.token` trước, không có
  thì đọc cookie từ `handshake.headers.cookie`.

**Mọi việc realtime làm được đều có bản REST song song**, và cả hai gọi chung một hàm service.
WebSocket là đường tắt, không phải đường duy nhất: lịch sử hội thoại phải tải được lúc mở màn
hình, và client mất kết nối vẫn phải gửi được tin.

### Phía client

Web (`frontend/src/lib/chat.ts`, `socket.ts`) và mobile (`mobile/src/domain/chat.ts`,
`mobile/src/lib/chatSocket.ts`) giữ cùng một hình dạng, và cùng ba quyết định:

- **Một socket cho cả app**, mở lười lúc màn hình chat đầu tiên cần tới. Mobile truyền `auth`
  vào socket.io là một **hàm**, không phải object: access token chỉ sống 15 phút và được làm
  mới ngầm, nên chốt cứng token lúc mở kết nối nghĩa là mọi lần kết nối lại sau đó đều mang một
  token đã chết — trên điện thoại, mất mạng rồi nối lại là chuyện thường chứ không phải ngoại
  lệ. Web không truyền `auth` gì cả — token nằm trong cookie `httpOnly`, trình duyệt tự đính
  kèm lại ở mỗi lần kết nối/kết nối lại.
- **Sự kiện đổ vào cache của react-query, không vào state màn hình.** Hai bản dữ liệu — một
  trong state, một trong cache — luôn có ngày lệch nhau. Cũng vì thế `message:new` phải bỏ qua
  tin đã có trong danh sách: người gửi nhận lại chính tin của mình (họ có thể mở cả web lẫn
  điện thoại), thêm hai lần thì khung chat hiện tin đôi.
- **Đăng xuất thì đóng socket.** Nó được xác thực một lần lúc bắt tay, nên giữ lại là để người
  đăng nhập tiếp theo trên cùng thiết bị nhận tin nhắn của người vừa đăng xuất.

Các câu hỏi mà mọi màn hình chat đều hỏi — hội thoại này tên gì, còn bao nhiêu tin chưa đọc,
mình có phải quản trị nhóm không — nằm trong một file hàm thuần mỗi phía. Chúng không dùng
chung được vì `shared/types.ts` chỉ chứa type, không mang được giá trị runtime sang cả hai bên.

## Thanh toán online: provider abstraction

Nhánh `feature/vnpay-payment-gateway` thêm cổng thanh toán VNPay cho hoá đơn thuê bao, cạnh
đường thủ công (chủ sân báo mã chuyển khoản, admin đối soát) vốn đã có — đường thủ công vẫn
giữ nguyên làm phương án dự phòng.

```
backend/src/services/payments/
  provider.interface.js   JSDoc mô tả hợp đồng: createPaymentUrl, verifySignature, isSuccess, parseCallback
  vnpay.provider.js       cài đặt cho VNPay
  index.js                getProvider(name) — tra registry, ném PAYMENT_PROVIDER_UNAVAILABLE nếu chưa cấu hình
```

`billing.service.js` chỉ gọi qua `getProvider(name)`, không import thẳng `vnpay.provider.js` —
thêm MoMo sau này là thêm một file cài đặt hợp đồng, không sửa `createCheckoutSession`/
`handleGatewayIpn`.

**Vì sao webhook nằm ngoài `/api`** (`app.js`, mount `/webhooks/payments` trước
`app.use('/api', globalLimiter, writeLimiter)`): VNPay gọi vào không mang JWT — `authenticate`
không áp dụng được — và endpoint không nên chia sẻ trần rate-limit dựng cho người dùng đã đăng
nhập. Có `webhookLimiter` riêng (đếm theo IP, vì không có `req.user`). Cùng lý do `/health` nằm
ngoài `/api` để probe của Docker không bị đếm.

**Vì sao có `PaymentTransaction` thay vì tái dùng `AdminAuditLog`.** Một lượt gọi cổng thanh
toán không phải hành động của admin — không có `adminId` nào trong luồng IPN — nên nhồi vào
audit log (vốn có mục đích riêng: dò dấu vết nếu tài khoản admin bị lạm quyền, xem
`adminAuditLog.service.js`) là sai chỗ. `PaymentTransaction` có unique index
`{provider, providerTxnRef}`: đây chính là cơ chế idempotent — IPN gọi lại (VNPay tự retry khi
không nhận được response) luôn tìm thấy bản ghi cũ, `findOneAndUpdate` với điều kiện
`status: 'pending'` đảm bảo chỉ một trong nhiều lần gọi trùng thắng được chuyển sang `'success'`,
không cộng `Subscription.totalPaid` hai lần.

**Return URL không phải nguồn sự thật.** VNPay redirect trình duyệt người dùng về
`vnp_ReturnUrl` sau khi thanh toán, nhưng lượt redirect này có thể không xảy ra (người dùng
đóng tab, mất mạng) và không đảm bảo tính toàn vẹn ngang IPN. `handleGatewayReturn` chỉ đọc để
quyết định thông báo "thành công"/"thất bại" cho UX, **không** gọi `confirmInvoicePaymentViaGateway`
— việc đó chỉ `handleGatewayIpn` (server-to-server) làm.

## Mobile: một màn hình đi qua đâu

```
app/                    expo-router — file nào cũng là một route, và CHỈ là một route
  _layout.tsx           SafeArea → React Query → AuthProvider → Stack
  (tabs)/               7 tab: tìm sân, lịch đặt, đội bóng, tin nhắn, thông báo, quản lý, hồ sơ
  (auth)/               đăng nhập, đăng ký, quên mật khẩu
  chat/                 khung hội thoại, tạo mới, thông tin nhóm
  owner/                chủ sân: lịch đặt, sân, đánh giá, gói thuê bao
  team/                 quản lý đội: lịch sân của đội
src/screens/            mọi màn hình, kèm test nằm cạnh
src/components/         Button, TextField, Badge, Avatar, Loading, EmptyState, ErrorState, Screen
src/services/           một facade cho mỗi nhóm endpoint, trả type của @fcp/shared
src/lib/                thứ chạm ra ngoài: authFetch, session, auth, push, api, chatSocket, errors
src/domain/             hàm thuần, không I/O: roles, slots, chat, format, notificationLinks
src/theme.ts            màu, khoảng cách, cỡ chữ — một nguồn duy nhất
```

Điều hướng theo file (`expo-router`) chứ không khai báo tay như React Navigation: cấu trúc
thư mục chính là sơ đồ màn hình, và deep link từ thông báo đẩy chỉ là một đường dẫn.

**File trong `app/` chỉ làm ba việc: đọc tham số URL, bọc `<Screen>`, gọi màn hình.** Mọi màn
hình sống ở `src/screens/`. Từng có hai kiểu song song — một nửa số route là vỏ mỏng 10 dòng,
nửa kia viết thẳng 250 dòng vào `app/` — và cái giá không phải là thẩm mỹ: màn hình nằm trong
`app/` thì test phải giả lập cả `expo-router` để dựng nó, nên chúng lặng lẽ không có test nào.
Cùng lý do đó, màn hình nhận `fieldId`/`teamId` qua **prop** chứ không tự gọi
`useLocalSearchParams` — route mới là chỗ biết đến URL.

**`lib/` và `domain/` chia theo một đường duy nhất: có chạm ra ngoài hay không.** `domain/` là
hàm thuần — test chúng không cần mock gì cả, và đó chính là nơi các quy tắc dễ sai nhất nằm
(khung giờ trống, tên hội thoại, vai trò). `lib/` là mạng, bộ nhớ máy, socket, thông báo đẩy.
Trộn hai thứ vào một thư mục 22 file thì không ai còn biết file nào an toàn để gọi từ đâu.

**Không chặn người chưa đăng nhập ở cửa vào.** Tìm sân, xem chi tiết sân và đọc đánh giá là
công khai; màn nào cần phiên thì bọc `RequireAuth` và mời đăng nhập ngay tại chỗ. Bắt đăng
nhập trước khi cho xem gì cả là cách nhanh nhất để mất người dùng mới.

**Token nằm trong Keychain/Keystore, không phải AsyncStorage** — AsyncStorage là file thường,
đọc được trên máy đã root hoặc qua bản sao lưu.

**Thông báo mang `link` của web, mobile phải dịch** (`src/domain/notificationLinks.ts`). Thêm một
màn hình mới cho vai trò nào thì phải quay lại bảng này — link chưa được dịch lại vẫn "chạy",
chỉ là đưa người dùng tới nhầm màn hình, nên không có lỗi nào nổ ra để nhắc.

**Quyền vào khu quản lý chỉ khai báo một lần** (`src/domain/roles.ts`). Thanh tab dùng nó để ẩn
hẳn tab "Quản lý", `RequireRole` dùng nó để chặn cửa màn hình. Hai nơi chép rời nhau thì sớm
muộn cũng lệch, và triệu chứng là một cái tab bấm vào chỉ để nhận thông báo từ chối. Đây là
lớp giải thích cho người dùng, **không phải** lớp bảo vệ — backend vẫn kiểm quyền từng endpoint.

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
- **Mongoose không làm phẳng object lồng nhau trong lệnh cập nhật.**
  `findByIdAndUpdate(id, { notifications: { push: false } })` **ghi đè cả cụm** `notifications`
  chứ không chỉ đổi `push`; các trường anh em biến mất lặng lẽ và Mongoose trả lại giá trị
  mặc định lúc đọc, nên nhìn qua tưởng vẫn đúng. Trường nào có anh em thì phải cập nhật bằng
  đường dẫn có dấu chấm (`'notifications.push'`) — xem `user.service.js > updateNotificationPrefs`.
- **Trần tần suất của chat nằm ở service, không phải middleware.** Tin nhắn tới bằng hai đường —
  `POST /chat/.../messages` và sự kiện WebSocket — mà chỉ đường đầu đi qua express, nên
  `express-rate-limit` không nhìn thấy đường thứ hai. Bộ đếm dùng `cache.incr` và nằm trong
  `chat.service`, để cả hai đường chung một hạn mức.
- **`connectRedis()` phải chịu được client đã kết nối sẵn.** `rate-limit-redis` nạp script Lua
  ngay khi middleware được tạo — tức là lúc `require('./app')`, trước khi `server.js` gọi
  `connectRedis()` — và lệnh đầu tiên đó đã tự mở kết nối. Gọi `connect()` lần nữa ném
  "Redis is already connecting/connected" và server chết ngay lúc khởi động.
- **Nhật ký hành động admin (`adminAuditLog.service.js`) cũng là hệ quả, không phải điều kiện** —
  cùng nguyên tắc với `notify()`. Đổi role, cấm tài khoản, xác nhận/huỷ hoá đơn, duyệt sân đều
  ghi một dòng vào `AdminAuditLog` *sau* khi thao tác chính đã thành công; lỗi ghi log chỉ vào
  logger, không được huỷ ngược thao tác đã làm xong. Mục đích là có dấu vết để điều tra nếu một
  tài khoản admin bị chiếm hoặc bị lạm quyền — không phải để chặn hành động.
- **JWT ký/xác thực ghim cứng `algorithm: 'HS256'`**, không để `jsonwebtoken` tự suy luận từ
  header của token. Thư viện hiện đã tự chặn `alg: none`, nhưng khai rõ thuật toán là phòng thủ
  theo chiều sâu — không phụ thuộc vào hành vi mặc định của một bản phát hành tương lai.
