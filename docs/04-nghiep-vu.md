# 04 — Quy tắc nghiệp vụ

Đây là những quy tắc mà đọc code sẽ thấy "làm gì", nhưng không thấy "vì sao".
Mỗi mục ghi kèm nơi cài đặt và test bảo vệ nó.

## Đặt sân

### Giá tính theo phần thời gian thực nằm trong từng khung

Ngày chia ba khung: sáng `00:00–12:00`, chiều `12:00–18:00`, tối `18:00–24:00`.
Mỗi khung có giá riêng cho ngày thường và cuối tuần.

Đặt 17:00–20:00 **không** phải 3 giờ giá chiều, mà là 1 giờ giá chiều + 2 giờ giá tối.
Cắt kiểu "lấy giá theo giờ bắt đầu" sẽ khiến khách đặt lúc 17:59 trả giá chiều cho cả buổi tối.

- Cài đặt: `calcPrice`/`calcSlotAmounts` trong `backend/src/services/pricing.service.js`
- Cuối tuần xác định theo **UTC** (`getUTCDay`), khớp với cách lưu ngày.
- Test: `backend/tests/unit/pricing.test.js` (qua `calcPrice`/`calcDuration` re-export ở
  `services/booking/`, giữ tương thích ngược) và `backend/tests/unit/pricing.service.test.js`.

### Giá theo ngày và khuyến mãi

Sân có thể có **ghi đè giá theo ngày** (`Field.priceOverrides` — lễ/Tết, mùa cao điểm) và
**mã khuyến mãi** (`Field.promotions` — giảm theo phần trăm hoặc số tiền cố định, có thể giới
hạn theo khung giờ, khoảng ngày và số lượt dùng).

Mọi biến thể đều đi qua đúng một đường tính: `calcBookingPrice(field, date, startTime, endTime,
promoCode)` trong `backend/src/services/pricing.service.js` — hàm này gọi `resolvePricingForDate`
(chọn bảng giá: ghi đè nếu ngày rơi vào khoảng ghi đè, mặc định nếu không), rồi `calcSlotAmounts`
(giống hệt phép tính overlap-thời-gian của `calcPrice`), rồi `resolvePromotion` (tìm mã còn hiệu
lực) để trừ đúng phần tiền của khung giờ mà mã áp dụng. **Không viết nhánh tính giá thứ hai** — dự
án từng có một hàm `calculatePrice` sai kiểu này trong `field.service.js` (nay là `services/field/`) và đã bị xoá (xem
`docs/08-lo-trinh.md`).

Khuyến mãi giới hạn theo khung giờ (`slots`) chỉ trừ trên phần tiền của đúng những khung đó, không
trừ trên tổng — đặt 17:00–20:00 với mã chỉ áp dụng buổi chiều thì chỉ phần 17:00–18:00 được giảm.

Mã khuyến mãi sai/hết hạn/hết lượt ném lỗi `PROMO_CODE_INVALID` khi đặt sân thật
(`POST /bookings`), nhưng **không** làm hỏng báo giá xem trước
(`GET /fields/:id/price-quote`) — endpoint đó bắt lỗi này và trả về giá gốc kèm `promoError` để
người dùng biết mã sai mà không chặn họ xem giá.

`GET /fields/:id/price-quote` là nguồn sự thật duy nhất cho ô xem giá phía client — trang tạo lịch
đặt không còn tự ước lượng giá (bản cũ tính sai theo kiểu "giá của giờ bắt đầu × số giờ", không
khớp cách chia khung thật).

- Cài đặt: `resolvePricingForDate`, `resolvePromotion`, `calcBookingPrice`,
  `previewBookingPrice` (`backend/src/services/pricing.service.js` và
  `backend/src/services/booking/`); CRUD ghi đè/khuyến mãi ở
  `backend/src/services/fieldPricing.service.js`.
- Lượt dùng mã (`usedCount`) chỉ tăng **sau khi** booking vượt qua bước kiểm tra trùng giờ lần hai
  — tránh đếm nhầm khi hai request cùng đặt một khung giờ và một trong hai bị hoàn tác.
- Test: `backend/tests/unit/pricing.service.test.js`, `backend/tests/unit/fieldPricing.service.test.js`,
  `backend/tests/unit/booking.service.test.js` (case `promoCode`).

### Điều kiện để đặt được

| Điều kiện | Mã lỗi khi vi phạm |
|---|---|
| Sân đang `active` | `FIELD_NOT_ACTIVE` |
| Sân đã được admin duyệt | `FIELD_NOT_VERIFIED` |
| Sân con tồn tại và `available` | `SUBFIELD_NOT_FOUND` / `SLOT_NOT_AVAILABLE` |
| Khung giờ nằm trong giờ mở cửa | `SLOT_NOT_AVAILABLE` |
| Thời lượng 0,5 – 6 tiếng | `VALIDATION_ERROR` |
| Giờ bắt đầu chưa trôi qua | `SLOT_NOT_AVAILABLE` |
| Đặt hộ đội thì phải là thành viên đội đó | `FORBIDDEN` |
| Khung giờ chưa ai đặt | `SLOT_NOT_AVAILABLE` (409) |

**Chống đặt trùng hai lần.** Hai request song song có thể cùng vượt qua bước kiểm tra
"khung giờ còn trống". Nên sau khi ghi, hệ thống kiểm tra lại một lần nữa và **xoá đơn vừa tạo**
nếu phát hiện trùng. Không có bước này thì hai người cùng bấm đặt sẽ cùng thành công.

### Huỷ đơn: cửa sổ 2 tiếng

- **Người đặt** phải huỷ trước giờ đá ít nhất **2 tiếng** — để chủ sân còn kịp bán lại khung giờ.
- **Chủ sân và admin** từ chối được bất cứ lúc nào (sân ngập, sự cố...).
- Chỉ đơn `pending` hoặc `confirmed` mới huỷ được.
- Test: `backend/tests/unit/booking.service.test.js`

### Vòng đời trạng thái

```
pending ──confirm──> confirmed ──complete──> completed
   │                     │
   └──cancel──> cancelled└──no-show──> no_show
```

- `complete` và `no_show` chỉ đặt được **sau** giờ bắt đầu — không thể kết thúc một trận chưa diễn ra.
- `complete` mới tăng `totalBookings` của sân và đặt `paymentStatus = paid`.

## Thách đấu và Elo

### Ai được làm gì

- **Gửi lời mời**: thành viên bất kỳ của đội gửi. Không tự thách đấu chính đội mình.
- **Trả lời**: chỉ quản lý hoặc đội trưởng của đội được mời.
- **Huỷ**: chỉ người đã gửi, và chỉ khi lời mời còn `pending`.
- Giữa hai đội chỉ tồn tại **một** lời mời `pending` tại một thời điểm.

### Nhập kết quả cần cả hai bên xác nhận

Một bên nhập tỉ số → ghi nhận cờ xác nhận của bên đó. Khi **cả hai** cùng xác nhận,
trận mới chuyển `completed` và Elo mới được cộng. Chỉ một bên xác nhận thì Elo không đổi —
nếu không, một đội có thể tự khai thắng để leo bảng xếp hạng.

Không nhập được kết quả cho trận **chưa tới giờ đá** — nếu không, Elo bị thổi phồng bằng
những trận không có thật.

### Công thức Elo

K = 32, công thức chuẩn: `new = old + K × (kết quả thực tế − kỳ vọng)`, kết quả thực tế là
1 / 0,5 / 0 cho thắng / hoà / thua. Hai đội ngang điểm: bên thắng +16, bên thua −16, hoà thì
không đổi. Thắng đội yếu hơn được ít điểm hơn thắng đội mạnh hơn.

- Cài đặt: `backend/src/utils/elo.js`
- Test: `backend/tests/unit/elo.test.js`, `backend/tests/unit/matchRequest.service.test.js`

## Đội bóng

- Người tạo đội thành `manager` và được cấp thêm role `team_manager`.
- Vào đội bằng **mã mời**; mã sinh ngẫu nhiên, quản lý đổi lại được bất cứ lúc nào.
- Đội đầy (`maxMembers`) thì không nhận thêm.
- **Quản lý không rời đội được** khi chưa chuyển quyền — nếu không đội mất người phụ trách.
- Chuyển quyền chỉ cho **thành viên đang hoạt động**; người cũ trở thành `player`.
- Xoá đội là **giải thể** (`status = disbanded`), không xoá bản ghi — lịch sử trận đấu phải còn.

## Đánh giá sân

- **Chỉ người đã hoàn thành một lượt đặt tại sân đó mới đánh giá được.** Không có rào này thì
  điểm sân là con số vô nghĩa. Đánh giá luôn được đánh dấu `isVerified`.
- Mỗi người đánh giá một sân **một lần**.
- Sửa/xoá: chỉ người viết, hoặc admin.
- Chủ sân trả lời được đánh giá trên sân của mình.
- Mỗi lần thêm/sửa/xoá đánh giá, điểm trung bình của sân được tính lại và cache của sân bị xoá.

## Thuê bao và hoá đơn

### Trạng thái

| Thuê bao | Ý nghĩa |
|---|---|
| `active` | Bình thường |
| `past_due` | Còn hoá đơn chưa thanh toán — **không thêm được sân mới** |
| `cancelled` | Đã tắt tự động gia hạn |

| Hoá đơn | Ý nghĩa |
|---|---|
| `pending` | Đã phát hành, chủ sân chưa trả |
| `awaiting_confirmation` | Chủ sân báo đã chuyển khoản, chờ admin đối soát |
| `paid` | Admin đã xác nhận nhận tiền |
| `void` | Huỷ (đổi gói hoặc admin huỷ) |

### Gia hạn "lười"

Không có cron. Mỗi lần đọc thuê bao, hệ thống kiểm tra chu kỳ đã hết chưa và xử lý ngay:

- Gói **miễn phí** hết chu kỳ → tự gia hạn, không hoá đơn.
- Gói **trả phí + còn tự động gia hạn** → phát hành hoá đơn, thuê bao chuyển `past_due`.
- Gói **trả phí + đã tắt gia hạn** → rơi về gói miễn phí, không tính tiền.

Cách này không cần job nền và không bao giờ phát hành trùng hoá đơn. Chặn `MAX_CATCH_UP_PERIODS = 12`
để một thuê bao bị bỏ quên nhiều năm không sinh ra hàng trăm hoá đơn cùng lúc.

### Đổi gói

- Đang ở đúng gói đó thì báo lỗi.
- **Không hạ gói khi số sân hiện có vượt hạn mức gói mới** — phải xoá bớt sân trước.
- Hoá đơn `pending` của gói cũ bị `void`, vì không còn ý nghĩa.
- Lên gói trả phí: phát hành hoá đơn và chuyển `past_due` ngay. Gói chỉ thực sự `active`
  sau khi admin xác nhận đã nhận tiền.

### Đối soát

Admin xác nhận hoá đơn → cộng `totalPaid`. Thuê bao chỉ trở lại `active` khi **không còn**
hoá đơn nào chưa thanh toán. Hoá đơn đã `paid` thì không huỷ được.

- Cài đặt: `backend/src/services/billing/`
- Test: `backend/tests/unit/billing.service.test.js`, `backend/tests/unit/billing.test.js`

### Thanh toán online (VNPay, MoMo)

Chủ sân bấm "Thanh toán online" ở hoá đơn `pending`/`awaiting_confirmation`, chọn cổng
(`vnpay` mặc định hoặc `momo`) → server tạo một `PaymentTransaction` (`status: 'pending'`) và
trả link thanh toán của cổng đó. Chủ sân thanh toán xong, hai việc xảy ra **độc lập nhau**:

1. **Return URL** (`GET /webhooks/payments/{vnpay|momo}/return`) — trình duyệt được redirect về
   đây. Chỉ dùng để báo "thành công"/"thất bại" cho UX, **không xác nhận đơn** — có thể không
   bao giờ xảy ra (đóng tab, mất mạng giữa chừng).
2. **IPN** (`GET /webhooks/payments/vnpay/ipn` hoặc `POST /webhooks/payments/momo/ipn`) — cổng
   gọi server-to-server, độc lập với việc người dùng có quay lại trang hay không. Đây mới là
   nguồn sự thật duy nhất xác nhận thanh toán. VNPay gọi bằng GET query, MoMo gọi bằng POST JSON
   body — khác định dạng nhưng cùng đi qua một hàm xử lý chung (`handleGatewayIpn`).

Xử lý IPN, theo đúng thứ tự (dừng ở bước đầu tiên không qua được), dùng chung cho mọi cổng:

1. Xác minh chữ ký (HMAC-SHA512 với VNPay, HMAC-SHA256 với MoMo) — sai thì coi như thất bại,
   không tra gì thêm.
2. Tra `PaymentTransaction` theo `(provider, providerTxnRef)` — không thấy thì bỏ qua.
3. Đã xử lý rồi (`status !== 'pending'`, tức IPN gọi lại) → **không cộng tiền lần hai**.
4. Số tiền không khớp `PaymentTransaction.amount` → đánh dấu giao dịch `failed`.
5. Hợp lệ → `findOneAndUpdate` với điều kiện `status: 'pending'` (chỉ một trong nhiều request
   đồng thời thắng), rồi mới gọi `confirmInvoicePaymentViaGateway` — dùng chung `settleInvoice`
   với đường đối soát thủ công, chỉ khác là ghi `paymentProvider`/`gatewayTransactionId` thay vì
   `confirmedBy` (không có admin nào trong luồng này).

VNPay và MoMo phản hồi IPN khác khuôn dạng nhau (VNPay đòi JSON `{RspCode, Message}` theo đúng
bảng mã của nó; MoMo không có bảng mã riêng, chỉ cần HTTP `204`) — mỗi cổng có controller riêng
dịch lại kết quả chung của `handleGatewayIpn` sang đúng khuôn dạng cổng đó hiểu, xem
[`docs/02-kien-truc.md`](02-kien-truc.md#thanh-toán-online-provider-abstraction).

Đường thủ công (chuyển khoản + admin đối soát) **vẫn giữ nguyên** làm phương án dự phòng —
không xoá, không thay thế.

- Cài đặt: `backend/src/services/payments/`, `backend/src/services/billing/`
  (`createCheckoutSession`, `handleGatewayIpn`, `handleGatewayReturn`), kiến trúc chi tiết ở
  [`docs/02-kien-truc.md`](02-kien-truc.md#thanh-toán-online-provider-abstraction).
- Test: `backend/tests/unit/vnpay.provider.test.js`, `backend/tests/unit/momo.provider.test.js`,
  `backend/tests/unit/billing.service.test.js`, `backend/tests/integration/paymentWebhook.routes.test.js`.

## Sân và duyệt sân

- Tạo sân phải qua **hạn mức gói** (`assertCanCreateField`), thêm sân con cũng vậy.
- Sân mới chưa `isVerified`; chủ sân **không tự bật `active`** được — phải gửi duyệt và chờ admin.
- Gửi duyệt yêu cầu có ít nhất một sân con.
- Admin từ chối → sân về `inactive` kèm `moderationNote`, **không xoá** — để chủ sân sửa rồi xin duyệt lại.
- Không xoá được sân (hoặc sân con) còn lịch đặt chưa kết thúc — người đặt sẽ mất chỗ mà không ai báo.
- Toạ độ lưu theo GeoJSON `[lng, lat]`, mặc định `[0, 0]` khi không có, để index `2dsphere` không vỡ.

## Thông báo in-app

Tám sự kiện **nhạy cảm thời gian** được bắn cho bên còn lại: có lịch đặt mới, lịch được xác nhận,
lịch bị huỷ, có lời mời thi đấu, lời mời được trả lời, đối thủ đã nhập tỉ số, hoá đơn mới, và
tin nhắn tới khi người nhận đang offline.
Danh sách đầy đủ kèm người nhận: [03 — Tham chiếu API](03-api.md#thông-báo--notifications).

Ba quy tắc quyết định cách tầng này hành xử:

**Thông báo không bao giờ làm hỏng hành động gốc.** `notify()` nuốt mọi lỗi và trả `null`.
Thông báo là hệ quả của một việc **đã thành công** — lịch đã xác nhận, hoá đơn đã phát hành.
Để một lần ghi hỏng cuộn ngược việc đó là đánh đổi ngược: người dùng mất việc chính chỉ vì
cái chuông không kêu.

**Không tự bắn cho chính người vừa hành động.** `notify()` nhận thêm `actorId` và bỏ qua khi
người nhận trùng người gây ra sự kiện. Chủ sân tự huỷ lịch trên sân mình không cần được báo
là mình vừa huỷ.

**Chỉ thêm loại thông báo cho việc biết muộn là mất mát.** Thêm sự kiện tham khảo
(ai đó xem sân, đội có thành viên mới) làm chuông kêu tới mức người dùng tắt hẳn — và thế là
mất luôn cả những thông báo thật sự quan trọng.

**Tắt một loại là tắt trên mọi kênh.** `User.notifications.mutedTypes` là danh sách
**chọn-không-nhận**; loại nằm trong đó thì `notify()` dừng ngay từ đầu — không ghi vào hộp thư,
cũng không đẩy tới điện thoại. Một nút tắt chỉ có tác dụng một nửa (im trên điện thoại nhưng
chuông vẫn đỏ) bị người dùng đọc thành "nút này hỏng". Sự kiện gốc vẫn tra được ở trang lịch đặt,
lời mời thi đấu hoặc hoá đơn — hộp thư là lớp tiện lợi, không phải bản ghi duy nhất.

## Tin nhắn

Chủ sân, quản lý đội và người chơi nhắn trực tiếp trong nền tảng, thay vì nhảy sang Zalo và
để lại toàn bộ bối cảnh (đổi giờ, đổi sân, thoả thuận trọng tài) ở ngoài hệ thống.

**Ai được mở hội thoại với ai là câu hỏi về quan hệ, không phải về vai trò.** Không có
`authorize(...)` nào ở route chat: chủ sân trong hội thoại này là người chơi trong hội thoại
khác. Ràng buộc thật nằm ở ngữ cảnh — muốn gắn hội thoại vào một lịch đặt thì hai người phải
đúng là khách và chủ sân của **chính lịch đặt đó**
([bảng đầy đủ](03-api.md#tin-nhắn--chat)). Không kiểm ở đây thì bất kỳ ai cũng treo hội thoại
của mình lên một lịch đặt của người khác và biến nó thành thứ trông như trao đổi chính thức.

**Nhắn thẳng (`direct`) thì mở cho mọi tài khoản đang hoạt động.** Người chơi phải hỏi được
chủ sân trước khi đặt, quản lý đội phải rủ được người lạ vào đội — nền tảng này không có khái
niệm kết bạn để mà dựa vào. Thứ chặn spam là **trần 30 tin/phút mỗi tài khoản**
(`CHAT_RATE_MAX`), không phải một danh sách bạn bè. Tài khoản bị khoá hoặc ngừng hoạt động thì
không mở được hội thoại mới tới.

**Một cặp người + một ngữ cảnh = đúng một hội thoại.** Khoá `key` (cặp id đã sắp xếp + ngữ
cảnh) có chỉ số unique, nên bấm "nhắn tin" lần thứ hai quay về đúng luồng cũ, kể cả khi hai
người bấm cùng lúc. Ngữ cảnh nằm trong khoá nên bàn về trận này không lẫn vào trận khác.

**Trạng thái đọc là một mốc thời gian mỗi người, không phải cờ trên từng tin nhắn.** Ghi cờ
cho từng tin nghĩa là mỗi lần mở hội thoại phải cập nhật hàng trăm bản ghi để nói đúng một
điều mà `participants.lastReadAt` đã nói đủ. Số chưa đọc thì đếm sẵn trong
`participants.unreadCount` — nó hiện trên mọi màn hình nên bị hỏi liên tục, mà chỉ đổi ở đúng
hai chỗ: lúc gửi và lúc đánh dấu đã đọc.

**Lưu trước, đẩy sau.** MongoDB là nguồn sự thật, WebSocket chỉ là đường tắt. Đẩy trước rồi
lưu lỗi nghĩa là hai người nhìn thấy một tin nhắn mà lịch sử hội thoại không có — kiểu sai tệ
nhất trong một khung chat, vì không ai biết mình đang sai.

**Chỉ đẩy thông báo khi người nhận thật sự offline.** Người đang mở ứng dụng đã thấy tin nhắn
hiện ra rồi; thêm một thông báo nữa là kêu hai lần cho cùng một việc. `emitter.isOnline()` đếm
kết nối trên toàn cụm chứ không chỉ instance hiện tại.

**Quản trị viên nền tảng đứng ngoài chat.** Họ xử lý khiếu nại bằng công cụ quản trị, nơi mọi
thao tác đều để lại dấu vết; một kênh riêng với admin trong app là kênh không ai kiểm được, và
là chỗ để người dùng tin rằng mình vừa "được hứa" điều gì đó. Chặn nằm ở cửa — `denyRoles` trên
router chat và một lần kiểm lúc bắt tay WebSocket — chứ không rải trong từng thao tác. Cả web
lẫn mobile đều giấu lối vào chat với admin, vì để lại một cái nút chỉ dẫn tới màn hình từ chối.

### Nhóm

**Chỉ quản trị nhóm được thêm, gỡ thành viên và đổi tên.** Ai cũng thêm được thì một nhóm đội
bóng biến thành chỗ người lạ kéo nhau vào, còn quản lý đội mất quyền kiểm soát chính cái nhóm
mình lập ra. Người tạo nhóm là quản trị đầu tiên. Trần **50 thành viên**.

**Tự gỡ mình không phải là "gỡ", mà là "rời nhóm".** Hai việc có hệ quả khác nhau nên có hai
đường riêng: gỡ là hành động của quản trị lên người khác, còn rời là quyền của mọi thành viên —
kể cả quản trị.

**Quản trị cuối cùng rời đi thì người kỳ cựu nhất lên thay**, nếu không nhóm kẹt vĩnh viễn ở
trạng thái không ai thêm được ai và không ai đổi được tên. **Người cuối cùng rời đi thì nhóm và
toàn bộ tin nhắn biến mất** — giữ lại một nhóm rỗng là giữ một đống dữ liệu không ai mở được nữa.

**Mọi thay đổi nhóm được ghi thành tin nhắn hệ thống** (`kind: 'system'`) trong chính dòng thời
gian ấy, không phải một bảng nhật ký riêng: thứ tự thời gian của một nhóm chỉ đúng khi mọi sự
kiện nằm chung một dòng. Client vẽ chúng khác tin nhắn thường — vẽ giống nhau thì người đọc
tưởng có người vừa nói câu đó.

- Cài đặt: `backend/src/services/chat/`, `backend/src/socket/`
- Test: `backend/tests/unit/chat.service.test.js`,
  `backend/tests/integration/chat.routes.test.js`,
  `backend/tests/integration/socket.test.js`

Danh sách chọn-không-nhận chứ không phải chọn-có-nhận: mặc định rỗng nên một loại thông báo
thêm về sau tự bật cho mọi người, không cần migration và không khiến cả nền tảng im lặng cho tới
khi từng người vào bật tay. Cờ `notifications.push` vẫn là công tắc tổng cho riêng kênh đẩy —
tắt nó thì thông báo vẫn vào hộp thư.

> Cờ `notifications.email` cũ đã bị xoá: không có luồng nào đọc tới nó (email chỉ dùng cho xác
> minh tài khoản và đặt lại mật khẩu — hai việc giao dịch, không được phép tắt). Giữ lại một
> công tắc không nối vào đâu chỉ là nói dối người dùng.

Hai chi tiết vận hành:

- **Số chưa đọc cache trên Redis** (`notif:unread:<userId>`, TTL 5 phút), xoá ngay khi có
  thông báo mới hoặc khi đánh dấu đã đọc. Chuông hỏi con số này trên mọi trang; đếm lại trong
  Mongo mỗi lần là lãng phí. Redis chết thì rơi về đếm thẳng trong Mongo, không vỡ request.
- **Thông báo tự hết hạn sau 90 ngày** bằng TTL index trên `createdAt`. Hộp thư không được
  phình vô hạn, và thông báo quá hạn ba tháng thì không còn ai đọc.

Chuông thông báo trên web vẫn hỏi lại mỗi 60 giây (polling) chứ **chưa** đi qua WebSocket, dù
nền tảng đã có sẵn kết nối realtime cho [tin nhắn](#tin-nhắn). Với một sự kiện vài phút mới có
một lần, biết sớm hơn vài chục giây không đổi được gì; nối chuông vào WebSocket chỉ đáng làm
khi web mở sẵn kết nối cho khung chat, và lúc đó là một việc riêng chứ không nhét kèm.

- Cài đặt: `backend/src/services/notification.service.js`, các lời gọi `notify()` nằm ngay tại
  service của sự kiện (booking / matchRequest / billing); tuỳ chọn ghi ở
  `user.service.js > updateNotificationPrefs`
- Test: `backend/tests/unit/notification.service.test.js`,
  `backend/tests/unit/user.service.test.js`,
  `backend/tests/integration/notifications.routes.test.js`
