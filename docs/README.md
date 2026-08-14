# Tài liệu Football Community Platform

> Cập nhật lần cuối: 2026-08-14

Đây là tài liệu chính thức của dự án. `memory/PROGRESS.md` trả lời "dự án đang ở đâu";
thư mục này trả lời "dự án là gì, chạy thế nào, và đi tiếp về đâu".

## Mục lục

| Tài liệu | Trả lời câu hỏi |
|---|---|
| [01 — Tổng quan sản phẩm](01-tong-quan.md) | Nền tảng này giải quyết việc gì, cho ai, kiếm tiền bằng cách nào |
| [02 — Kiến trúc](02-kien-truc.md) | Code nằm ở đâu, một request đi qua những tầng nào |
| [03 — Tham chiếu API](03-api.md) | Có những endpoint nào, ai được gọi, trả về gì |
| [04 — Quy tắc nghiệp vụ](04-nghiep-vu.md) | Giá tính ra sao, khi nào được huỷ, Elo cộng thế nào, hạn mức gói |
| [05 — Redis và rate limit](05-redis-rate-limit.md) | Cache gì, hạn mức bao nhiêu, Redis chết thì sao |
| [06 — Kiểm thử](06-kiem-thu.md) | Test nằm ở đâu, chạy thế nào, viết thêm ra sao |
| [07 — Vận hành](07-van-hanh.md) | Biến môi trường, chạy local, Docker, CI, health check |
| [08 — Lộ trình](08-lo-trinh.md) | Nghiệp vụ và chức năng làm tiếp, theo thứ tự ưu tiên |
| [09 — CodeGraph](09-codegraph.md) | Công cụ đọc hiểu codebase cho AI agent |

## Quy ước

- **Tài liệu viết bằng tiếng Việt**, tên biến / endpoint / mã lỗi giữ nguyên tiếng Anh như trong code.
- Mỗi tài liệu nêu **lý do** của quyết định, không chỉ mô tả hiện trạng — git history đã ghi lại "đã đổi gì" rồi.
- **Đổi code là đổi tài liệu trong cùng một lần làm việc.** Xem [rule trong `CLAUDE.md`](../CLAUDE.md).
