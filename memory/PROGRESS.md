# Bối cảnh dự án

> Cập nhật lần cuối: 2026-08-19
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

**Tuỳ chọn thông báo theo từng loại** (nhánh `feature/fullstack-notification-preferences`)
- `User.notifications.mutedTypes` — danh sách chọn-không-nhận; tắt một loại là tắt cả hộp thư lẫn thông báo đẩy.
- Endpoint riêng `PATCH /users/me/notifications` ghi bằng đường dẫn có dấu chấm, nên gạt công tắc này không xoá tuỳ chọn kia.
- Web: `/notifications/settings` (vào từ nút bánh răng ở hộp thư). Mobile: màn hình "Cài đặt thông báo" mở từ hồ sơ.
- Cờ `notifications.email` bị xoá — không luồng nào đọc tới nó.

**Khu quản lý trên mobile** (nhánh `feature/mobile-owner-screens`, `feature/mobile-owner-reviews-billing`)
- Tab "Quản lý" chỉ hiện với chủ sân / quản lý đội / admin; người chơi thuần không thấy tab (`href: null`).
- Chủ sân: số liệu sân, duyệt lịch đặt (xác nhận, hoàn thành, khách không đến, huỷ kèm lý do), bật tắt nhận đặt từng sân, hộp thư đánh giá + phản hồi, gói thuê bao + khai báo chuyển khoản.
- Quản lý đội: lịch sân của đội, cạnh đội của tôi và lời mời thi đấu.
- Quyền vào khu quản lý khai báo một lần ở `mobile/src/domain/roles.ts`, tab và `RequireRole` dùng chung.

**Chat thời gian thực — phía backend** (nhánh `feature/be-chat-websocket`)
- Hội thoại 1-1 giữa hai tài khoản bất kỳ, kèm ngữ cảnh tuỳ chọn (`booking`, `match_request`, `field`) quyết định ai được mở hội thoại với ai. Một cặp người + một ngữ cảnh = đúng một hội thoại (chỉ số unique trên `key`).
- Sáu endpoint dưới `/api/v1/chat` và WebSocket socket.io gắn vào **cùng cổng 5001**; cả hai đường gọi chung `chat.service`.
- Số chưa đọc đếm sẵn theo từng người, "đã xem" bằng một mốc thời gian, "đang nhập" không lưu, trần 30 tin/phút mỗi tài khoản (`CHAT_RATE_MAX`).
- Thông báo đẩy `chat_message` chỉ bắn khi người nhận không có thiết bị nào đang kết nối.
- Redis adapter cho socket.io để nhiều instance thấy nhau; `shared/types.ts` đã có type hội thoại, tin nhắn và tên sự kiện.

**Chat nhóm và giao diện chat cho web + mobile** (nhánh `feature/chat-group-web-mobile`)
- Nhóm nhiều người (tối đa 50): người tạo là quản trị nhóm, chỉ quản trị được thêm / gỡ / đổi tên. Rời nhóm là quyền của mọi người; quản trị cuối rời thì người kỳ cựu nhất lên thay, người cuối cùng rời thì nhóm và tin nhắn bị xoá.
- Mọi thay đổi nhóm ghi thành tin nhắn `kind: 'system'` ngay trong dòng thời gian hội thoại, không phải bảng nhật ký riêng.
- `GET /users/search` để tìm người nhắn tin / mời vào nhóm, lọc sẵn admin và tài khoản bị khoá — ô gợi ý không bao giờ đề xuất một người mà bấm vào sẽ nhận 403.
- **Quản trị viên nền tảng đứng ngoài chat**, chặn ở `denyRoles` trên router và một lần kiểm lúc bắt tay WebSocket; web và mobile đều giấu lối vào.
- Web: hộp thư `/chat`, khung hội thoại, hộp thoại tạo mới/tạo nhóm, lối vào trên navbar kèm số chưa đọc.
- Mobile: tab "Tin nhắn" (hộp thư, khung chat, tạo mới, thông tin nhóm); thông báo `chat_message` mở thẳng đúng hội thoại.

**Access token chuyển sang cookie httpOnly cho web** (nhánh `security/access-token-httponly-cookie`)
- Web không còn nhận `accessToken` trong response body — cả access lẫn refresh token đều là
  cookie `httpOnly` do backend đặt lúc login/refresh. `authStore` không giữ token nữa, `api.ts`
  không còn interceptor gắn `Authorization` bằng tay, `sessionStorage` bị xoá hoàn toàn khỏi
  luồng auth. Trước đó access token nằm trong `sessionStorage` — JS đọc được, nên vẫn là bề mặt
  lộ token nếu bị XSS dù đã tốt hơn `localStorage`.
- `authenticate`, `authenticateSocket`, và khoá đếm rate limit đều đọc token theo thứ tự: header
  `Authorization: Bearer` trước (mobile), rơi về cookie `accessToken` nếu không có (web).
- Mobile không đổi gì — đã dùng SecureStore (Keychain/Keystore) từ trước, không phải
  `localStorage`, và tiếp tục nhận token qua body nhờ header `X-Client: mobile`.
- CSRF vẫn chỉ dựa vào `SameSite=Strict` (không thêm CSRF token riêng) — xem ghi chú trong
  [`docs/02-kien-truc.md`](../docs/02-kien-truc.md#xác-thực).

**CI/CD và giám sát dependency** (nhánh `chore/ci-security-scanning`)
- CodeQL quét tĩnh JS/TS trên mỗi push/PR vào `main`/`dev` cộng một lượt hàng tuần.
- Dependabot mở PR cập nhật dependency hàng tuần cho cả ba phía và cho GitHub Actions.
- CI có thêm `npm audit`: chặn build ở mức `critical`, chỉ ghi log (không chặn) ở mức `high` vì
  nhiều lỗ hổng high hiện tại chỉ vá được bằng bản major (Next.js, Expo, nodemailer).
- Đã áp các bản vá không phá API (`npm audit fix`, không `--force`) cho backend và frontend —
  xem "Việc nên làm tiếp" cho phần còn lại cần nâng bản major.

## Đang làm / còn dở

- **Thông báo đẩy chưa kiểm trên thiết bị thật** — Expo Go trên Android từ SDK 53 không cấp được push token, cần development build và `eas.projectId` trong `app.json`. Đường đi trên backend đã có test và đã chạy thử với stack thật.
- **Chat chưa gắn vào ngữ cảnh.** Backend nhận `contextType`/`contextRef` (`booking`, `match_request`, `field`) và có luật riêng cho từng loại từ đầu, nhưng chưa màn hình nào gửi lên — mọi hội thoại client mở đều là `direct`. Việc còn lại là nút "nhắn tin" ở trang sân, lịch đặt và lời mời thi đấu, trên cả web lẫn mobile.
- Mobile còn thiếu **tạo/sửa sân**, **đổi gói thuê bao** và **toàn bộ khu admin** — cố ý để trên web vì cần màn hình rộng (biểu mẫu ảnh + bảng giá + sân con, bảng đối soát).
- Chưa mở PR cho tám nhánh `feature/role-dashboards-and-billing`, `chore/testing-and-mobile-workspace`, `feature/codegraph-tests-redis-docs`, `feature/notifications`, `feature/mobile-app`, `feature/fullstack-notification-preferences`, `feature/mobile-owner-screens`, `feature/chat-group-web-mobile` (nhánh sau xây trên nhánh trước).

## Việc nên làm tiếp

Lộ trình đầy đủ kèm phạm vi và định nghĩa hoàn thành: [`docs/08-lo-trinh.md`](../docs/08-lo-trinh.md). Ba việc đầu bảng:

1. Nút "nhắn tin" trong ngữ cảnh (sân / lịch đặt / lời mời thi đấu) — phần khiến chat gắn vào việc đang làm thay vì là một hộp thư rời.
2. Cổng thanh toán trực tuyến cho hoá đơn thuê bao (VNPay/MoMo) — bỏ khâu admin đối soát tay.
3. Giá linh hoạt và khuyến mãi cho chủ sân — mọi biến thể vẫn phải đi qua `calcPrice`.

Ngoài lộ trình tính năng, còn tồn đọng về hạ tầng:

- **Nâng major các dependency còn lỗ hổng high** mà `npm audit fix` không tự vá được: `nodemailer`
  (backend), `next` (frontend, kéo theo `postcss`/`sharp`), toàn bộ chuỗi `expo`/`metro`/
  `react-native` (mobile). Mỗi bản nâng đều là breaking change, cần làm riêng và test kỹ, không
  nên gộp vào một lần nâng cấp bảo mật.
- **Audit log cho hành động admin chưa có** — biết ai duyệt/khoá/xoá gì và lúc nào. Cần trước khi
  lên sản phẩm thật; đã cân nhắc trong phiên rà soát 2026-08-19 nhưng để lại làm riêng.

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
- **Định dạng tiền và ngày chỉ có một chỗ mỗi phía**: `frontend/src/lib/format.ts` và `mobile/src/domain/format.ts`. Bốn trang web từng tự khai lại `formatPrice` — bản chép thiếu `maximumFractionDigits: 0`, chưa lệch hiển thị vì VND vốn không có phần lẻ, nên không ai phát hiện. Đừng khai lại trong file trang.
- **Cổng phân quyền trên web chỉ có `RoleGuard`** (`components/dashboard/`). Bỏ trống `allow` là chỉ đòi đăng nhập. Từng có thêm `OwnerGuard` bọc ngoài chỉ để truyền sẵn ba prop, khiến ba khu quản lý dùng hai kiểu khác nhau; nó đã bị xoá.
- **Chỉ có một hàm tính giá** (`calcPrice` trong `booking.service.js`). Hàm thứ hai `calculatePrice` trong `field.service.js` tính sai (lấy giá của giờ bắt đầu cho cả buổi) và đã bị xoá — đừng tạo lại.
- **Thông báo không được làm hỏng hành động gốc.** `notify()` chạy sau khi việc chính đã xong và nuốt mọi lỗi. Đừng đặt nó vào giữa luồng nghiệp vụ, và đừng bỏ `actorId` — thiếu nó là người dùng tự nhận thông báo về chính việc mình vừa làm.
- **`connectRedis()` không được gọi `connect()` vô điều kiện.** `rate-limit-redis` nạp script Lua ngay lúc `require('./app')` và lệnh đó đã tự mở kết nối; gọi lại ném "Redis is already connecting/connected" và server chết lúc khởi động. Đây từng là lỗi thật, chỉ lộ ra khi chạy `node src/server.js` chứ test không bắt được.
- **Token đẩy là `select: false`.** Expo không xác thực người gửi: ai cầm được token là đẩy được thông báo về máy đó. Mọi truy vấn cần nó phải `.select('expoPushTokens')` tường minh.
- **Cờ gom nhóm refresh token phải dọn trong `.finally`.** Dọn trong thân hàm `async` thì nhánh "chưa có refresh token" (chạy hết mà không `await`) bị chính phép gán ghi đè, cờ kẹt lại và app không bao giờ làm mới token nữa. Test bắt được lỗi này chỉ khi các ca chạy chung một file.
- **Sau `fireEvent` trong test RNTL phải `waitFor`.** Không thì test *kế tiếp* trong cùng file mới hỏng, kèm cảnh báo "overlapping act()" rất khó lần ra. Cùng lý do đó, `get*` ngay sau `fireEvent` đọc trúng cây cũ: form vừa mở ra tìm không thấy, và nút submit vẫn còn `disabled` nên bấm vào không có gì xảy ra và test chỉ báo "Number of calls: 0". Phải `await screen.findBy*`, rồi `waitFor` cho tới khi nút hết khoá mới bấm.
- **Mongoose ghi đè cả cụm khi cập nhật object lồng nhau.** `findByIdAndUpdate(id, { notifications: { push: false } })` xoá luôn các trường anh em trong `notifications`; đọc lại thấy giá trị mặc định nên nhìn qua tưởng vẫn đúng. Phải ghi bằng đường dẫn có dấu chấm.
- **Test RNTL dùng react-query phải cho `notifyManager` chạy đồng bộ** (`setScheduler((cb) => cb())`) và đặt `mutations.gcTime: 0`. Mặc định react-query hẹn giờ `setTimeout(0)` để gom thông báo và giữ cache 5 phút: cái đầu bắn cảnh báo act() vào **test kế tiếp** (chạy riêng thì sạch), cái sau khiến jest phải giết worker vì còn hẹn giờ treo.
- **Rate limit đếm theo tài khoản khi đã đăng nhập** (`user:<id>`), chỉ khách mới đếm theo IP — 4G qua CGNAT và wifi văn phòng dùng chung IP, đếm thuần theo IP là chặn nhầm người dùng thật. Khoá lấy từ access token và **phải xác minh chữ ký**; limiter chạy trước `authenticate` nên không có `req.user` để dùng lại.
- **TTL của vé thu hồi token phải lấy từ `exp` của token.** Hằng số 15 phút trùng với mặc định `JWT_ACCESS_EXPIRES_IN` nên trông vẫn đúng; đổi biến môi trường thành `1h` là token đã đăng xuất dùng lại được từ phút thứ 15. Test cũ không bắt được vì nó cũng chạy với mặc định 15 phút — test mới phải tự đổi biến môi trường.
- **Mobile dịch `link` của thông báo bằng một bảng tra** (`notificationLinks.ts`). Thêm màn hình cho vai trò mới mà quên cập nhật bảng thì không có lỗi nào nổ ra, người dùng chỉ lặng lẽ bị đưa tới nhầm chỗ — `/owner/bookings` từng trỏ về tab lịch đặt của người chơi.
- **Chữ trên nút trùng nhãn bộ lọc thì `getByText` ném "Found multiple elements".** Màn lịch đặt có chip lọc "Hoàn thành" lẫn nút "Hoàn thành". Cách sửa đúng không phải đổi chữ mà là đặt `accessibilityLabel` riêng cho từng đơn ("Hoàn thành lịch của Nguyễn Văn A") — trong một danh sách, trình đọc màn hình cũng chỉ nghe thấy một dãy nút giống hệt nhau.
- **jsdom không có `PointerEvent`**, mà Base UI dựng nó trong handler click của Switch. Thiếu polyfill trong `vitest.setup.ts` thì `onCheckedChange` im lặng không chạy và lỗi nổ ngoài stack của test.
- **Service không được `require` thẳng tầng socket.** Tầng socket đã require service để xử lý sự kiện; chiều ngược lại tạo vòng require và một trong hai module nhận về object rỗng. Mọi lần đẩy realtime đi qua `socket/emitter.js` — module này không require gì của socket, chỉ giữ tham chiếu `io` và im lặng khi chưa có (test, hoặc tiến trình chỉ chạy REST).
- **`createSocketServer` phải chạy sau `connectRedis()`.** Redis adapter nhân bản client Redis; nhân bản một client chưa từng kết nối thì bản sao cũng không có kết nối. Và thiếu hẳn adapter thì hai người ngồi trên hai instance khác nhau không nhận được tin của nhau — local một instance không bao giờ tái hiện được.
- **Trần tần suất của chat nằm trong service, không phải middleware.** Tin nhắn tới bằng cả REST lẫn WebSocket, mà `express-rate-limit` chỉ nhìn thấy đường REST. Thêm luật nào cho tin nhắn thì đặt trong `chat.service`, đừng đặt ở route — nếu không WebSocket thành cửa sau đi vòng qua nó.
- **Token WebSocket đi trong `handshake.auth`, không phải header.** Trình duyệt không cho đặt header tuỳ ý trên kết nối WebSocket, nên header chỉ tới được server ở giai đoạn polling rồi biến mất đúng lúc client nâng cấp — triệu chứng là "chạy được lúc đầu rồi tự rớt".
- **Lỗi trong handler socket phải tự bắt.** Sự kiện WebSocket không có response như HTTP: lỗi ném ra rơi thẳng vào `unhandledRejection` và `server.js` giết cả tiến trình, trong khi client chỉ thấy tin nhắn của mình biến mất không dấu vết.
- **`server.close()` không chờ được WebSocket.** Kết nối WebSocket không bao giờ tự kết thúc, nên phải `io.close()` trước, nếu không mỗi lần tắt server là chờ đủ 10 giây rồi bị ép thoát.
- **`$match` trong aggregate không tự ép chuỗi thành ObjectId** như query thường. Quên `new mongoose.Types.ObjectId(...)` thì không khớp gì cả và số chưa đọc lặng lẽ đứng ở 0 — không có lỗi nào để nhắc.
- **Jest backend đặt `maxWorkers: 2`.** Để jest tự chọn theo số nhân CPU thì worker bị giết vì hết RAM ("JavaScript heap out of memory").
- **`auth` của socket.io client phải là hàm, không phải object.** Access token sống 15 phút và được làm mới ngầm; chốt cứng token lúc mở kết nối thì mọi lần kết nối lại sau đó đều mang một token đã chết. Trên điện thoại, mất mạng rồi nối lại là chuyện thường, nên lỗi này biểu hiện thành "chat tự chết sau một lúc".
- **Đăng xuất phải đóng socket chat.** Kết nối được xác thực một lần lúc bắt tay: giữ nó lại là để người đăng nhập tiếp theo trên cùng thiết bị nhận tin nhắn của người vừa đăng xuất.
- **Màn hình mobile nằm ở `src/screens/`, `app/` chỉ chứa route.** Route làm đúng ba việc: đọc tham số URL, bọc `<Screen>`, gọi màn hình. Màn hình nhận `fieldId`/`teamId` qua prop chứ không tự gọi `useLocalSearchParams`. Từng có hai kiểu song song và cái giá không phải thẩm mỹ: 14 màn hình viết thẳng vào `app/` đều không có test nào, vì test chúng phải giả lập cả `expo-router`.
- **`mobile/src/lib/` = có chạm ra ngoài (mạng, bộ nhớ máy, socket, push); `mobile/src/domain/` = hàm thuần.** Đường chia là "test nó có cần mock gì không". `src/theme.ts` đứng riêng vì nó không thuộc nhóm nào.
- **Hai `fireEvent` trong cùng một ca test là "overlapping act()".** Nó không làm hỏng chính ca đó mà làm hỏng **mọi ca sau nó** trong cùng file, với thông báo "Unable to find an element" hoàn toàn không liên quan. Tách thành hai ca, hoặc `await` một truy vấn ở giữa. Cũng vì vậy, `onPress` của `Alert` gọi thẳng phải bọc `act(async () => ...)` — nó khởi động một mutation ngoài mọi act scope.
- **Mobile `/chat/<id>` trùng đúng đường dẫn của web**, nên `notificationLinks` dùng lại nguyên link thay vì tra bảng. Bảng tra chỉ khớp đường dẫn nguyên vẹn, mà thông báo chat mang theo mã hội thoại.
