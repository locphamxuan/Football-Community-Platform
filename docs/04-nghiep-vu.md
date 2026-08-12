# 04 — Quy tắc nghiệp vụ

Đây là những quy tắc mà đọc code sẽ thấy "làm gì", nhưng không thấy "vì sao".
Mỗi mục ghi kèm nơi cài đặt và test bảo vệ nó.

## Đặt sân

### Giá tính theo phần thời gian thực nằm trong từng khung

Ngày chia ba khung: sáng `00:00–12:00`, chiều `12:00–18:00`, tối `18:00–24:00`.
Mỗi khung có giá riêng cho ngày thường và cuối tuần.

Đặt 17:00–20:00 **không** phải 3 giờ giá chiều, mà là 1 giờ giá chiều + 2 giờ giá tối.
Cắt kiểu "lấy giá theo giờ bắt đầu" sẽ khiến khách đặt lúc 17:59 trả giá chiều cho cả buổi tối.

- Cài đặt: `calcPrice` trong `backend/src/services/booking.service.js`
- Cuối tuần xác định theo **UTC** (`getUTCDay`), khớp với cách lưu ngày.
- Test: `backend/tests/unit/pricing.test.js`

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

- Cài đặt: `backend/src/services/billing.service.js`
- Test: `backend/tests/unit/billing.service.test.js`, `backend/tests/unit/billing.test.js`

## Sân và duyệt sân

- Tạo sân phải qua **hạn mức gói** (`assertCanCreateField`), thêm sân con cũng vậy.
- Sân mới chưa `isVerified`; chủ sân **không tự bật `active`** được — phải gửi duyệt và chờ admin.
- Gửi duyệt yêu cầu có ít nhất một sân con.
- Admin từ chối → sân về `inactive` kèm `moderationNote`, **không xoá** — để chủ sân sửa rồi xin duyệt lại.
- Không xoá được sân (hoặc sân con) còn lịch đặt chưa kết thúc — người đặt sẽ mất chỗ mà không ai báo.
- Toạ độ lưu theo GeoJSON `[lng, lat]`, mặc định `[0, 0]` khi không có, để index `2dsphere` không vỡ.

## Thông báo in-app

Bảy sự kiện **nhạy cảm thời gian** được bắn cho bên còn lại: có lịch đặt mới, lịch được xác nhận,
lịch bị huỷ, có lời mời thi đấu, lời mời được trả lời, đối thủ đã nhập tỉ số, hoá đơn mới.
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

Hai chi tiết vận hành:

- **Số chưa đọc cache trên Redis** (`notif:unread:<userId>`, TTL 5 phút), xoá ngay khi có
  thông báo mới hoặc khi đánh dấu đã đọc. Chuông hỏi con số này trên mọi trang; đếm lại trong
  Mongo mỗi lần là lãng phí. Redis chết thì rơi về đếm thẳng trong Mongo, không vỡ request.
- **Thông báo tự hết hạn sau 90 ngày** bằng TTL index trên `createdAt`. Hộp thư không được
  phình vô hạn, và thông báo quá hạn ba tháng thì không còn ai đọc.

Web hỏi lại mỗi 60 giây (polling), **chưa** dùng WebSocket: một kết nối thường trực cho mỗi
tab là cái giá quá đắt so với việc biết sớm hơn vài chục giây.

- Cài đặt: `backend/src/services/notification.service.js`, các lời gọi `notify()` nằm ngay tại
  service của sự kiện (booking / matchRequest / billing)
- Test: `backend/tests/unit/notification.service.test.js`,
  `backend/tests/integration/notifications.routes.test.js`
