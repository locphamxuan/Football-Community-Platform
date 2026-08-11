# 01 — Tổng quan sản phẩm

## Vấn đề

Đá bóng phong trào ở Việt Nam vướng ba việc lặp đi lặp lại: tìm sân trống đúng khung giờ,
gom đủ đối thủ cho một trận, và chủ sân thì quản lý lịch đặt bằng sổ tay hoặc tin nhắn.
Nền tảng gom cả ba vào một chỗ.

## Bốn vai trò

| Vai trò | Mã trong code | Làm được gì |
|---|---|---|
| Người chơi | `user` | Tìm sân, đặt sân, đánh giá sân, tham gia đội |
| Quản lý đội | `team_manager` | Tạo đội, quản lý thành viên, gửi/nhận lời mời thi đấu, nhập kết quả |
| Chủ sân | `field_owner` | Đăng sân và sân con, duyệt lịch đặt, xem doanh thu, trả phí thuê bao |
| Quản trị viên | `admin` | Duyệt sân, quản lý người dùng, đối soát hoá đơn, xem toàn cảnh nền tảng |

Một tài khoản mang **nhiều vai trò cùng lúc** (`roles` là mảng). Tạo đội sẽ tự cấp thêm
`team_manager`; nhận vai trò `field_owner` là do admin cấp.

## Mô hình doanh thu

> **Doanh thu nền tảng ≠ tiền đặt sân.** Đây là điểm dễ hiểu nhầm nhất của dự án.

- Tiền khách trả cho một lượt đặt sân là **GMV** — tiền của chủ sân, nền tảng không ăn chia.
- Nền tảng thu **phí thuê bao hàng tháng** của chủ sân theo gói. Đây là doanh thu duy nhất.

Không dashboard nào được cộng hai con số này lại.

### Ba gói thuê bao

| Gói | Giá / tháng | Số sân | Sân con mỗi sân |
|---|---|---|---|
| `free` — Miễn phí | 0 ₫ | 1 | 2 |
| `basic` — Cơ bản | 299.000 ₫ | 3 | 6 |
| `pro` — Chuyên nghiệp | 799.000 ₫ | 20 | 20 |

Thanh toán bằng **chuyển khoản thủ công**: hệ thống phát hành hoá đơn → chủ sân chuyển khoản
rồi khai mã giao dịch → admin đối soát và xác nhận. Chưa có cổng thanh toán trực tuyến
(xem [lộ trình](08-lo-trinh.md)).

## Các luồng chính

**Đặt sân.** Người chơi tìm sân → xem lịch trống theo ngày/giờ → đặt (trạng thái `pending`)
→ chủ sân xác nhận (`confirmed`) → sau trận, chủ sân đánh dấu `completed` hoặc `no_show`.
Người đặt có thể huỷ, nhưng phải trước giờ đá ít nhất 2 tiếng.

**Thách đấu.** Đội A gửi lời mời tới đội B → quản lý/đội trưởng đội B chấp nhận →
sau trận, **cả hai bên** nhập tỉ số → hệ thống tính Elo và đóng trận.

**Lên sân.** Chủ sân tạo sân → thêm sân con → gửi duyệt → admin duyệt → sân mở bán.
Sân chưa được duyệt thì chủ sân không tự bật nhận đặt được.

**Thuê bao.** Chủ sân đổi gói → hệ thống phát hành hoá đơn, thuê bao chuyển `past_due`
→ chủ sân báo đã chuyển khoản → admin xác nhận → thuê bao trở lại `active`.
Khi đang nợ hoá đơn, chủ sân không thêm được sân mới.

Chi tiết từng quy tắc nằm ở [04 — Quy tắc nghiệp vụ](04-nghiep-vu.md).
