# 07 — Vận hành

## Cổng cố định

| Dịch vụ | Cổng |
|---|---|
| Backend | 5001 |
| Frontend | 3001 |
| Redis | 6379 |

Đổi `PORT` của backend là phải đổi cả `ports` của service backend trong `docker-compose.yml`
và `NEXT_PUBLIC_API_URL` trong `frontend/.env.local`.

> **Bẫy đã dính:** container `fcp-backend` tự khởi động cùng Docker và chiếm cổng 5001.
> Chạy backend từ source thì `docker stop fcp-backend` trước, nếu không sẽ gọi nhầm vào
> container cũ mà không hiểu vì sao code mới không có tác dụng.

## Biến môi trường (backend)

Chép `backend/.env.example` thành `backend/.env`. Biến **bắt buộc** — thiếu thì tiến trình
thoát ngay với thông báo rõ tên biến:

`MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`EMAIL_USER`, `EMAIL_PASS`.

Biến tuỳ chọn đáng chú ý:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | 5000 | Dự án đặt 5001 |
| `CLIENT_URL` | `http://localhost:3000` | Origin cho CORS **và** link trong email — phải khớp cổng frontend (3001) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | |
| `REDIS_URL` | `redis://localhost:6379` | |
| `RATE_LIMIT_*` | xem [05](05-redis-rate-limit.md) | |
| `CHAT_RATE_MAX` | 30 | Tin nhắn tối đa mỗi tài khoản trong 60 giây. Đếm trong `chat.service` chứ không phải middleware, vì tin nhắn qua WebSocket không đi qua express |

## Chạy local

```bash
# 1. Redis (backend không boot nếu thiếu)
docker compose up -d redis

# 2. Backend
cd backend && npm install && npm run dev        # http://localhost:5001

# 3. Frontend
cd frontend && npm install && npm run dev       # http://localhost:3001

# 4. Mobile
cd mobile && npm install && npm start
```

Mobile trên **giả lập Android** phải gọi `10.0.2.2:5001`, không phải `127.0.0.1:5001` —
localhost trong giả lập là chính nó. Chạy trên máy thật hoặc trỏ tới server thì đặt
`EXPO_PUBLIC_API_URL` (ví dụ `EXPO_PUBLIC_API_URL=http://192.168.1.10:5001/api/v1`).

**Thông báo đẩy cần development build.** Expo Go trên Android từ SDK 53 không cấp được push
token, và `getExpoPushTokenAsync` cần `eas.projectId` trong `app.json`. Thiếu một trong hai thì
app vẫn chạy bình thường, chỉ là không có thông báo đẩy — mọi nhánh hỏng đều trả `null` chứ
không ném lỗi.

## Kiểm tra sức khoẻ

```bash
curl http://localhost:5001/health
```

`redis` khác `ready` nghĩa là cache và rate limit đang chạy ở chế độ suy giảm — xem
[05 — Redis và rate limit](05-redis-rate-limit.md).

## WebSocket

Chat dùng socket.io gắn vào **cùng cổng 5001** với REST — không có cổng riêng nào phải mở.
Log lúc khởi động in `💬 WebSocket: ws://localhost:5001` sau dòng API.

Hai điều dễ dính khi đưa lên server thật:

- **Proxy phải cho phép nâng cấp lên WebSocket.** Nginx cần `proxy_set_header Upgrade` và
  `Connection "upgrade"` cho đường `/socket.io/`; thiếu thì client vẫn "chạy" bằng long-polling,
  chậm hơn nhưng không có lỗi nào để nhắc.
- **Redis là bắt buộc khi chạy nhiều instance.** Adapter đồng bộ qua Redis; thiếu nó thì hai
  người ngồi trên hai instance khác nhau không nhận được tin của nhau, và local một instance
  thì không bao giờ tái hiện được lỗi này.

## Verify trước khi commit

Kiểm **mọi phía đã đụng tới**:

```bash
cd backend  && npm run lint && npm test
cd frontend && npx tsc --noEmit && npm run lint && npm test -- --run && npm run build
cd mobile   && npm run typecheck && npm test
```

Sửa `shared/` là chạm cả web lẫn mobile — verify cả hai.

Với thay đổi ở service/controller, chạy thêm với stack thật (`docker compose up -d redis`
rồi `node src/server.js`) và gọi các endpoint bị ảnh hưởng, gồm cả trường hợp không có quyền
và trường hợp dữ liệu sai. Xoá mọi script thử, file log, bản ghi test đã tạo trong lúc kiểm tra.

## CI

`.github/workflows` chạy lint / typecheck / test / build **riêng cho từng phía**, dùng
`dorny/paths-filter` nên chỉ phía nào có thay đổi mới chạy job của phía đó.

## Ghi log

Winston, ra stdout. Ở production dùng JSON, ở dev dùng bản màu dễ đọc, trong test thì **tắt
hẳn** (test cố tình bắn lỗi để kiểm nhánh xử lý, in ra chỉ làm nhiễu kết quả).

Lỗi không lường trước được ghi kèm stack ở mức `error`, còn client chỉ nhận
`An unexpected error occurred` — chi tiết không bao giờ lọt ra ngoài.
