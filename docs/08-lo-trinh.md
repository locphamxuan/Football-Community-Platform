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

**Phạm vi.**

- Collection `Notification` + endpoint `GET /notifications`, `PATCH /notifications/:id/read`.
- Sự kiện cần bắn: lịch đặt được xác nhận / bị từ chối, có lời mời thi đấu, lời mời được trả lời,
  đối thủ đã nhập tỉ số, hoá đơn mới, hoá đơn sắp tới hạn.
- Đẩy cho mobile bằng Expo Push: lưu `expoPushToken` trên `User`, tôn trọng cờ
  `notifications.push` đã có sẵn trong hồ sơ.
- Đếm số chưa đọc nên cache trên Redis.

**Xong khi.** Nhận được thông báo đẩy trên thiết bị thật cho ít nhất ba sự kiện trên, và
người dùng tắt được từng loại.

### 2.2 Mobile bắt kịp web

**Vì sao.** Mobile mới có một màn hình bảng giá để chứng minh app đọc đúng hợp đồng API.
Người chơi phong trào dùng điện thoại là chính.

**Phạm vi, theo thứ tự.**

1. `expo-router` + điều hướng tab.
2. Đăng nhập, lưu token bằng `expo-secure-store` (**không** dùng AsyncStorage cho token).
3. Tìm sân + trang chi tiết sân.
4. Đặt sân và xem lịch đặt của mình.
5. Đội bóng và lời mời thi đấu.

**Xong khi.** Một người chơi làm trọn được vòng "tìm sân → đặt → xem lịch" trên điện thoại.

### 2.3 Chat trong lời mời thi đấu

**Vì sao.** Hai đội chốt trận vẫn phải nhảy sang Zalo, nên nền tảng mất luôn phần bối cảnh
(đổi giờ, đổi sân, thoả thuận trọng tài).

**Phạm vi.** Tin nhắn gắn với một `MatchRequest`, chỉ thành viên hai đội đọc được. Bắt đầu bằng
polling — chỉ chuyển sang WebSocket khi có số liệu chứng minh là cần.

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
