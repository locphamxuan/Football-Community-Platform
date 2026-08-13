# 05 — Redis và rate limit

Redis làm hai việc: **cache** và **bộ đếm rate limit**. Backend không boot được nếu không
kết nối được Redis (`connectRedis` chạy trong `server.js`).

> `connectRedis()` phải chịu được client **đã kết nối sẵn**: `rate-limit-redis` nạp script Lua
> ngay khi middleware được tạo, tức là lúc `require('./app')` — trước khi `server.js` gọi tới —
> và lệnh đó đã tự mở kết nối. Gọi `connect()` lần nữa ném
> `Redis is already connecting/connected` và server chết ngay lúc khởi động.

## Cache

| Khoá | TTL | Xoá khi nào |
|---|---|---|
| `field:{id}` | 10 phút | Sửa sân, thêm/sửa/xoá sân con, duyệt sân, có đánh giá mới |
| `field:availability:{fieldId}:{YYYY-MM-DD}` | 30 giây | Tạo / huỷ / hoàn thành / đánh vắng một lượt đặt |
| `blacklist:token:{jti}` | 15 phút | Tự hết hạn cùng access token |
| `notif:unread:{userId}` | 5 phút | Có thông báo mới, đánh dấu đã đọc một hoặc tất cả |

TTL của lịch trống cố tình để rất ngắn: lịch sân đổi liên tục, một phút dữ liệu cũ là đủ để
hai người đặt trùng khung giờ.

Số thông báo chưa đọc bị xoá cache ngay khi nó đổi, nên TTL 5 phút chỉ là lưới an toàn phòng
khi một lần xoá thất bại. Chuông hỏi con số này trên mọi trang của mọi người dùng đang online.

### Redis là tầng tăng tốc, không phải nguồn sự thật

MongoDB trả lời được mọi câu hỏi mà cache trả lời. Nên **mọi thao tác cache đi qua hàm `safe`**:
Redis lỗi thì ghi log và trả về giá trị mặc định, request vẫn chạy tiếp (chậm hơn).

Trước đây một lần Redis chớp tắt sẽ khiến `authenticate` ném lỗi và trả về
`401 Invalid or expired token` — người dùng bị đăng xuất hàng loạt vì một sự cố cache.

**Đánh đổi phải biết:** khi Redis chết, `cache.exists` trả `false`, nên **access token đã
logout vẫn dùng được cho tới khi hết hạn** (tối đa `JWT_ACCESS_EXPIRES_IN`, mặc định 15 phút).
Chọn như vậy vì phương án còn lại là chặn toàn bộ người dùng mỗi khi Redis chớp tắt.
Sự cố Redis luôn xuất hiện trong log ở mức `error`.

Cài đặt: `backend/src/config/redis.js`.

## Rate limit

Bốn tầng, xếp từ rộng tới hẹp:

| Limiter | Áp dụng cho | Cửa sổ | Mặc định | Biến môi trường |
|---|---|---|---|---|
| `globalLimiter` | Toàn bộ `/api` | 15 phút | 300 | `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` |
| `writeLimiter` | `/api` nhưng **bỏ qua** GET/HEAD/OPTIONS | 1 phút | 60 | `RATE_LIMIT_WRITE_MAX` |
| `authLimiter` | Đăng ký, đăng nhập, quên/đặt lại mật khẩu, gửi lại email | 15 phút | 10 | `RATE_LIMIT_AUTH_MAX` |
| `uploadLimiter` | Các endpoint nhận ảnh | 1 phút | 20 | `RATE_LIMIT_UPLOAD_MAX` |

Vì sao tách `writeLimiter`: một request ghi (tạo booking, đổi gói, nhập kết quả) tốn kém hơn
đọc rất nhiều và là nơi kẻ xấu spam. Tách ra thì siết được ghi mà không làm phiền người dùng
đang lướt danh sách sân.

`/health` nằm ngoài `/api` nên **không bị đếm** — probe của Docker gọi nó liên tục.

### Đếm theo tài khoản, không phải theo IP

Người dùng đã đăng nhập được đếm theo `user:<id>`, khách vãng lai mới đếm theo IP.

Lý do: ở Việt Nam 4G đi qua CGNAT và cả một văn phòng chung một IP công cộng. Đếm thuần theo
IP nghĩa là vài người dùng bình thường đủ làm cạn hạn mức của tất cả những người còn lại đứng
sau cùng một đường mạng.

Khoá được lấy từ access token và **chữ ký phải được xác minh**, không chỉ giải mã: tin `sub`
trong một token bịa là mở cửa cho hạn mức vô hạn — kẻ tấn công chỉ cần đổi token mỗi request.
Token hỏng hoặc hết hạn thì rơi về IP.

Limiter gắn ở mức `/api`, tức là **chạy trước `authenticate`**, nên nó không đọc được
`req.user` mà phải tự đọc header — đừng "dọn" chỗ này thành `req.user.id`.

`authLimiter` trên thực tế vẫn đếm theo IP vì request đăng nhập chưa có token, và đó đúng là
điều mong muốn: kẻ dò mật khẩu không có tài khoản nào để bị đếm theo.

### Bộ đếm nằm trên Redis

`rate-limit-redis` giữ bộ đếm trên Redis thay vì trong RAM của tiến trình. Nhờ vậy:

- Nhiều instance backend **dùng chung một hạn mức** — chạy 3 instance không có nghĩa là
  hạn mức tăng gấp ba.
- Hạn mức **không bị xoá sạch mỗi lần deploy**, nên restart không phải cách vượt rào.

Mỗi limiter dùng prefix riêng (`rl:global:`, `rl:write:`, `rl:auth:`, `rl:upload:`) nên cạn
hạn mức ở nhóm này không ảnh hưởng nhóm khác.

Mọi limiter bật `passOnStoreError: true`: Redis chết thì request đi tiếp, không biến sự cố
cache thành lỗi 500.

Đặt `RATE_LIMIT_USE_REDIS=false` để đếm trong RAM (test tự đặt sẵn giá trị này).

### Khuôn dạng khi bị chặn

```json
{ "success": false, "message": "Too many requests, please try again later.", "code": "TOO_MANY_REQUESTS" }
```

Kèm header chuẩn `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
(header `X-RateLimit-*` cũ đã tắt) để client tự giãn nhịp.

Cài đặt: `backend/src/middleware/rateLimiter.js`. Test: `backend/tests/unit/rateLimiter.test.js`.

## Health check

```bash
curl http://localhost:5001/health
# { "status": "ok", "env": "development", "redis": "ready", "timestamp": "..." }
```

Trường `redis` nhận `ready`, `disconnected`, hoặc trạng thái ioredis đang có
(`connecting`, `reconnecting`, `end`...). Đây là cách nhanh nhất để biết một hành vi lạ
có phải do Redis hay không.
