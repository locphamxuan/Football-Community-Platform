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
| `VNPAY_TMN_CODE` | rỗng | Mã merchant VNPay. **Tuỳ chọn** — thiếu thì `checkout` trả `PAYMENT_PROVIDER_UNAVAILABLE` (503) thay vì chặn server khởi động; đường chuyển khoản thủ công vẫn chạy bình thường |
| `VNPAY_HASH_SECRET` | rỗng | Secret key ký/xác minh chữ ký HMAC-SHA512 |
| `VNPAY_URL` | sandbox VNPay | Sandbox demo dùng được ngay, không cần đăng ký merchant thật — xem [tài liệu tích hợp VNPay](https://sandbox.vnpayment.vn/apis/) để lấy `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET` demo |
| `VNPAY_RETURN_URL` | `{CLIENT_URL}/owner/billing` | Trang trình duyệt quay về sau khi thanh toán — chỉ UX, không xác nhận đơn |

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

`.github/workflows/ci.yml` chạy lint / typecheck / test / build **riêng cho từng phía**, dùng
`dorny/paths-filter` nên chỉ phía nào có thay đổi mới chạy job của phía đó. Mỗi job còn chạy
`npm audit` hai lần: `--audit-level=critical` là cổng chặn (build đỏ nếu có lỗ hổng mức
critical), `--audit-level=high` chỉ để ghi log chứ không chặn — một số gói (Next.js, Expo...)
có lỗ hổng high chỉ vá được bằng bản major mới, ép chặn ngay bây giờ sẽ khoá đỏ CI vĩnh viễn
cho tới khi ai đó chủ động nâng cấp và kiểm tra breaking change (`nodemailer` đã nâng lên v9,
xem `memory/PROGRESS.md`).

`.github/workflows/codeql.yml` quét tĩnh JavaScript/TypeScript bằng CodeQL — chạy trên mỗi
push/PR vào `main`/`dev` và thêm một lượt hàng tuần (thứ Hai) để bắt lỗ hổng mới phát hiện
trên code không đổi. Free vì repo public; sang private phải có GitHub Advanced Security.

`.github/dependabot.yml` mở PR cập nhật dependency hàng tuần cho cả ba phía (`backend/`,
`frontend/`, `mobile/`) và cho chính GitHub Actions, gom các bản patch/minor vào một PR để đỡ
loãng — bản major (Next.js, Expo...) vẫn tách riêng vì luôn cần review kỹ.

## Ghi log

Winston, ra stdout. Ở production dùng JSON, ở dev dùng bản màu dễ đọc, trong test thì **tắt
hẳn** (test cố tình bắn lỗi để kiểm nhánh xử lý, in ra chỉ làm nhiễu kết quả).

Lỗi không lường trước được ghi kèm stack ở mức `error`, còn client chỉ nhận
`An unexpected error occurred` — chi tiết không bao giờ lọt ra ngoài.
