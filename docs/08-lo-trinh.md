# 08 — Lộ trình phát triển

Xếp theo thứ tự ưu tiên. Mỗi mục ghi **vì sao cần**, **phạm vi**, và **định nghĩa hoàn thành** —
đủ để bắt tay làm mà không phải đoán lại.

Trạng thái hiện tại: xem [`memory/PROGRESS.md`](../memory/PROGRESS.md).

---

## Ưu tiên 1 — Doanh thu và thanh toán

### 1.1 Cổng thanh toán trực tuyến cho hoá đơn thuê bao

**Vì sao.** Hiện chủ sân chuyển khoản rồi khai mã giao dịch, admin đối soát tay. Mỗi hoá đơn
tốn công một người và có độ trễ hàng giờ tới hàng ngày; càng nhiều chủ sân thì càng không kham nổi.

**Phạm vi.** Tích hợp VNPay hoặc MoMo (hai cổng phổ biến nhất cho SME Việt Nam):

- Tạo link thanh toán từ một `Invoice` đang `pending`.
- Endpoint nhận IPN/webhook — **phải xác minh chữ ký**, và **phải chịu được gọi lại nhiều lần**
  (cổng gửi lặp là chuyện bình thường): xác nhận hai lần không được cộng `totalPaid` hai lần.
- Giữ nguyên đường chuyển khoản thủ công làm phương án dự phòng.

**Xong khi.** Hoá đơn tự chuyển `paid` sau webhook hợp lệ; thuê bao tự `active` khi hết công nợ;
có test cho webhook trùng lặp và cho chữ ký sai.

### 1.2 Thanh toán tiền đặt sân (đặt cọc)

**Vì sao.** Tỉ lệ `no_show` là nỗi đau lớn nhất của chủ sân. Cọc trước là cách chặn hiệu quả nhất.

**Phạm vi.** Trường `depositAmount` trên `Field` (chủ sân tự đặt, có thể bằng 0). Đơn đặt sân
sang trạng thái `awaiting_payment` cho tới khi cọc xong. Quy tắc hoàn cọc gắn với
[cửa sổ huỷ 2 tiếng](04-nghiep-vu.md#huỷ-đơn-cửa-sổ-2-tiếng): huỷ đúng hạn hoàn đủ, quá hạn mất cọc.

> Đây vẫn là tiền của chủ sân, không phải doanh thu nền tảng. Nếu sau này nền tảng giữ hộ tiền cọc,
> phải tách rõ trên sổ sách trước khi làm.

**Xong khi.** Đặt sân có cọc chạy trọn vòng: đặt → trả cọc → xác nhận → huỷ → hoàn cọc, kèm test.

---

## Ưu tiên 2 — Giữ chân người dùng

### 2.1 Thông báo (in-app + đẩy)

**Vì sao.** Hiện toàn bộ tương tác dựa vào email hoặc việc người dùng tự mở app. Lời mời thi đấu
và xác nhận lịch đặt là hai việc **nhạy cảm thời gian** — biết muộn là mất trận.

**✅ Đã xong — phần in-app.** Collection `Notification`, bốn endpoint dưới `/notifications`,
bảy sự kiện được bắn từ booking / thách đấu / hoá đơn, số chưa đọc cache trên Redis, chuông
trên web hỏi lại mỗi 60 giây. Quy tắc và lý do:
[04 — Quy tắc nghiệp vụ](04-nghiep-vu.md#thông-báo-in-app).

**✅ Đã xong — phần đẩy.** `User.expoPushTokens` (mảng, một token cho mỗi thiết bị,
`select: false`), hai endpoint đăng ký / gỡ thiết bị, `notify()` bắn kèm thông báo đẩy khi hồ sơ
bật `notifications.push`, token chết bị dọn khi Expo báo `DeviceNotRegistered`. App mobile tự
đăng ký thiết bị lúc đăng nhập và gỡ lúc đăng xuất.

**✅ Đã xong — tắt theo từng loại.** `User.notifications.mutedTypes` (danh sách chọn-không-nhận),
endpoint riêng `PATCH /users/me/notifications`, trang cài đặt trên web (`/notifications/settings`)
và màn hình tương ứng trên mobile. Tắt một loại là tắt cả hộp thư lẫn thông báo đẩy — lý do:
[04 — Quy tắc nghiệp vụ](04-nghiep-vu.md#thông-báo-in-app). Cờ `notifications.email` đã bị xoá
vì không luồng nào đọc tới.

**Còn lại.**

- **Kiểm trên thiết bị thật.** Expo Go trên Android từ SDK 53 không lấy được push token —
  cần một development build, và cần `eas.projectId` trong cấu hình app.
- **Nhắc hoá đơn sắp tới hạn.** Đây là loại duy nhất trong danh sách ban đầu **không** gắn với
  một hành động của ai cả, nên không có chỗ nào để `notify()` bám vào. Nó cần một job nền —
  mà dự án đã cố tình không có cron (xem [gia hạn "lười"](04-nghiep-vu.md#gia-hạn-lười)).
  Làm nó là mở lại quyết định đó, nên tách riêng chứ không nhét kèm.

**Xong khi.** Nhận được thông báo đẩy trên thiết bị thật cho ít nhất ba sự kiện.

### 2.2 Mobile bắt kịp web

**Vì sao.** Người chơi phong trào dùng điện thoại là chính.

**✅ Đã xong — toàn bộ phần dành cho người chơi.** `expo-router` với 5 tab, đăng nhập / đăng ký /
quên mật khẩu, tìm sân và chi tiết sân, đặt sân với kiểm tra khung giờ trống, lịch đặt kèm huỷ và
đánh giá, đội bóng (tạo, tham gia, rời), lời mời thi đấu và nhập tỉ số, hộp thư thông báo, hồ sơ.
Kiến trúc và lý do: [02 — Kiến trúc](02-kien-truc.md#mobile-một-màn-hình-đi-qua-đâu).

**✅ Đã xong — khu quản lý cho chủ sân và quản lý đội.** Tab "Quản lý" chỉ hiện với tài khoản có
vai trò quản lý (`href: null` gỡ hẳn tab, thay vì dẫn tới một màn hình từ chối). Bên trong:

- **Chủ sân:** số liệu sân, duyệt lịch đặt (xác nhận / hoàn thành / khách không đến / huỷ kèm lý
  do), bật tắt nhận đặt từng sân, hộp thư đánh giá kèm số chờ trả lời và ô phản hồi, gói thuê bao
  với mức đã dùng, công tắc tự gia hạn và khai báo mã chuyển khoản cho hoá đơn.
- **Quản lý đội:** đội của tôi, lời mời thi đấu và lịch sân của đội.

**Còn lại.** Ba việc cố ý để trên web vì cần màn hình rộng: **tạo và sửa sân** (biểu mẫu có ảnh,
bảng giá, sân con), **đổi gói thuê bao** (phải đối chiếu hạn mức từng gói với số sân đang có) và
**toàn bộ khu admin** (bảng đối soát, duyệt sân, quản lý người dùng).

### 2.3 Chat giữa chủ sân, quản lý đội và người chơi

**Vì sao.** Hai đội chốt trận — và khách hỏi chủ sân — vẫn phải nhảy sang Zalo, nên nền tảng
mất luôn phần bối cảnh (đổi giờ, đổi sân, thoả thuận trọng tài).

**✅ Đã xong — toàn bộ phía backend.** Hội thoại 1-1 giữa hai tài khoản bất kỳ, kèm ngữ cảnh
tuỳ chọn (`booking`, `match_request`, `field`) quyết định ai được mở hội thoại với ai. REST
(`/api/v1/chat`) và WebSocket (socket.io, cùng cổng 5001) gọi chung một tầng service; số chưa
đọc, "đã xem", "đang nhập", trần 30 tin/phút mỗi tài khoản, và thông báo đẩy chỉ khi người nhận
không có thiết bị nào đang kết nối. Quy tắc và lý do:
[04 — Tin nhắn](04-nghiep-vu.md#tin-nhắn); giao thức: [03 — Tin nhắn](03-api.md#tin-nhắn--chat).

**Còn lại.** Giao diện web và mobile: hộp thư, khung hội thoại, nút "nhắn tin" ở trang sân /
lịch đặt / lời mời thi đấu, và client socket.io gắn vào vòng đời đăng nhập (kết nối lại bằng
token mới sau mỗi lần refresh).

**Chưa làm, có chủ đích.** Gửi ảnh trong tin nhắn, chat nhóm cho cả đội, xoá / thu hồi tin
nhắn, chặn người dùng. Mỗi cái là một quyết định riêng chứ không phải phần còn thiếu của cái
đã làm — đặc biệt là chặn người dùng: hiện nay thứ giữ spam là trần tần suất, và một danh sách
chặn chỉ đáng thêm khi có spam thật để nhìn.

---

## Ưu tiên 3 — Giá trị cho chủ sân

### 3.1 Giá linh hoạt và khuyến mãi

**Vì sao.** Ba khung giá cố định không đủ diễn tả thực tế: sân trống buổi sáng ngày thường,
kín cứng 18–20h. Chủ sân cần công cụ tự kéo khách vào giờ vắng.

**Phạm vi.** Ghi đè giá theo ngày cụ thể (lễ, Tết), mã giảm giá theo khung giờ, giá theo mùa.
Phải giữ nguyên nguyên tắc **chia giá theo phần thời gian nằm trong từng khung** — mọi biến thể
đều đi qua `calcPrice`, không viết nhánh tính giá thứ hai.

> Đã từng có một hàm tính giá thứ hai (`calculatePrice` trong `field.service.js`) tính sai
> theo kiểu "lấy giá của giờ bắt đầu cho cả buổi". Nó đã bị xoá. Đừng tạo lại.

### 3.2 Đặt lịch định kỳ

**Vì sao.** Rất nhiều đội đá cố định "tối thứ Tư hàng tuần". Hiện phải đặt tay từng tuần.

**Phạm vi.** Tạo chuỗi booking theo tuần với ngày kết thúc; huỷ được một buổi hoặc cả chuỗi;
phát hiện xung đột ngay lúc tạo và báo rõ những buổi không đặt được.

### 3.3 Báo cáo sâu hơn cho chủ sân

Tỉ lệ lấp đầy theo khung giờ, khách quay lại, tỉ lệ huỷ và `no_show` theo tháng, xuất CSV.
Dữ liệu đã có sẵn trong `Booking` — đây thuần tuý là tầng aggregate và giao diện.

---

## Ưu tiên 4 — Cộng đồng

### 4.1 Giải đấu

**Vì sao.** Bước tiếp theo tự nhiên của Elo và hệ thống đội bóng, và là thứ giữ đội quay lại
đều đặn nhất.

**Phạm vi.** Model `Tournament` (vòng tròn hoặc loại trực tiếp), đăng ký đội, bốc thăm, bảng
xếp hạng, kết quả tự chảy vào Elo. Chủ sân đăng cai được — mở ra một nguồn doanh thu mới cho nền tảng.

### 4.2 Bảng xếp hạng và hồ sơ cầu thủ

Bảng xếp hạng đội theo khu vực và trình độ; thống kê cá nhân (số trận, bàn thắng) trên hồ sơ.

### 4.3 Tìm người thiếu chân

Đội thiếu người đăng tin trước trận, người chơi tự do nhận chỗ. Cần cơ chế đánh giá uy tín
để chống bùng kèo.

---

## Nợ kỹ thuật cần trả song song

| Việc | Vì sao |
|---|---|
| Test tích hợp có cơ sở dữ liệu thật (`mongodb-memory-server`) | Test hiện tại không chạm MongoDB nên không bắt được lỗi index, unique, truy vấn sai |
| Chuẩn hoá phân trang | Vài endpoint trả mảng trần, vài endpoint trả kèm `meta.pagination` |
| Xoá mềm cho `Field` | Xoá cứng sẽ mồ côi các booking đã hoàn thành trong lịch sử |
| Nhật ký thao tác của admin | Khoá tài khoản, đổi vai trò, huỷ hoá đơn hiện không lưu vết ai làm |
| Nghiên cứu chuyển backend sang TypeScript | Hợp đồng API đã có type ở `shared/`; backend vẫn đứng ngoài. Là quyết định lớn, cần chủ dự án đồng ý |
