# 09 — Triển khai production

> Free-tier: Vercel (frontend) + Render (backend) + MongoDB Atlas + Upstash Redis + EAS (mobile APK demo).

## Vì sao cấu trúc domain như thế này

Backend (`*.onrender.com`) và frontend (`*.vercel.app`) là hai origin khác nhau. Cookie auth
đặt `sameSite: 'strict'` (xem `backend/src/controllers/auth.controller.js`) nên trình duyệt sẽ
**không bao giờ gửi cookie** nếu request đi thẳng cross-site — login/chat sẽ chạy được ở dev
nhưng chết hẳn ở production.

Giải pháp: `frontend/next.config.ts` proxy `/api/*` và `/socket.io/*` sang backend qua
`rewrites()`. Trình duyệt chỉ thấy một origin (Vercel), Vercel âm thầm forward sang Render —
cookie do backend set sẽ tự nhiên gắn vào domain Vercel vì trình duyệt chưa từng thấy origin
Render. Không cần domain riêng, không cần nới `sameSite`.

## 1. MongoDB Atlas

1. Tạo tài khoản tại mongodb.com/cloud/atlas, tạo cluster free tier (M0).
2. Database Access → tạo user + password.
3. Network Access → cho phép `0.0.0.0/0` (Render dùng IP động, không có dải cố định để whitelist).
4. Lấy connection string dạng `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/football-platform`
   → đây là giá trị `MONGODB_URI`.

## 2. Upstash Redis

1. Tạo tài khoản tại upstash.com, tạo Redis database free tier (chọn region gần Render, vd. Oregon/Singapore).
2. Copy connection string dạng `rediss://default:<password>@<host>:<port>` → giá trị `REDIS_URL`.
   Lưu ý `rediss://` (2 chữ s, TLS) chứ không phải `redis://`.

## 3. Backend trên Render

1. Tạo tài khoản render.com, kết nối GitHub repo, chọn **New → Blueprint** và trỏ vào
   `render.yaml` ở gốc repo (đã chuẩn bị sẵn, build bằng `backend/Dockerfile`).
2. Điền các env var được đánh dấu `sync: false` trong `render.yaml` ở dashboard Render:
   `MONGODB_URI`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (≥32 ký tự ngẫu nhiên — dùng
   `openssl rand -base64 48` để sinh), `REDIS_URL`, `CLOUDINARY_*`, `EMAIL_*`, `VNPAY_*`/`MOMO_*`
   (có thể để trống nếu chỉ demo — `checkout` sẽ trả `PAYMENT_PROVIDER_UNAVAILABLE`, không chặn
   server khởi động).
3. `CLIENT_URL` **phải điền sau khi có URL Vercel thật** ở bước 4 (vd.
   `https://fcp-yourname.vercel.app`) — sai giá trị này thì CORS chặn hết request từ frontend.
4. Sau khi deploy xong, health check: `curl https://<ten-service>.onrender.com/health`.

> Render free tier tự sleep sau 15 phút không traffic — request đầu tiên sau khi sleep mất
> ~30-50s để cold-start, đây là giới hạn free tier, không phải bug.

## 4. Frontend trên Vercel

1. Tạo tài khoản vercel.com, import repo, **Root Directory = `frontend`**.
2. Env var trên Vercel:
   - `BACKEND_URL` = URL Render ở bước 3 (server-only, không có prefix `NEXT_PUBLIC_`,
     dùng bởi `rewrites()` trong `next.config.ts`)
   - `NEXT_PUBLIC_API_URL` = `/api/v1` (đường dẫn tương đối — đi qua proxy, KHÔNG trỏ thẳng
     Render)
   - `NEXT_PUBLIC_APP_NAME` (tuỳ chọn)
3. Deploy. Lấy URL Vercel thật, quay lại Render cập nhật `CLIENT_URL` (bước 3.3), redeploy backend.
4. Xác minh WebSocket qua proxy: mở DevTools → Network → tab `/socket.io/...` phải là
   `101 Switching Protocols`, không phải long-polling liên tục. Vercel proxy WS qua `rewrites()`
   tới destination ngoài là pattern đã dùng phổ biến, nhưng **đây là bước cần verify thật sau khi
   deploy** — nếu không lên WS được, phương án dự phòng là polling-only (`socket.io` tự fallback,
   chậm hơn nhưng không lỗi).

## 5. Mobile — build APK demo bằng EAS

`mobile/eas.json` đã có 3 profile (`development`/`preview`/`production`), `mobile/app.json` đã
có `android.package`. Còn thiếu `extra.eas.projectId` — giá trị này gắn với tài khoản Expo cụ
thể nên không thể set sẵn trước:

```bash
cd mobile
npx eas login              # tài khoản Expo (free) — tạo tại expo.dev nếu chưa có
npx eas init                # tự điền extra.eas.projectId vào app.json
# Sửa EXPO_PUBLIC_API_URL trong mobile/eas.json (profile preview/production) thành URL Render thật
npx eas build --platform android --profile preview
```

`eas build` xong sẽ ra link tải APK trực tiếp — cài lên điện thoại Android thật để demo, không
cần Google Play. Không submit App Store/Play Store trong lần này (theo quyết định của
[08-lo-trinh.md](08-lo-trinh.md) — chỉ cần bản demo cho portfolio).

## Checklist trước khi coi là "đã deploy"

- [ ] `curl https://<backend>.onrender.com/health` trả `redis: ready`
- [ ] Đăng ký + đăng nhập trên frontend Vercel thật (không phải localhost) — xác nhận cookie
      giữ được session sau khi reload
- [ ] Mở chat, xác nhận tin nhắn realtime qua WebSocket (không phải chỉ polling)
- [ ] Đặt sân demo, kiểm tra luồng thanh toán (VNPay/MoMo sandbox hoặc chuyển khoản thủ công)
- [ ] Cài APK từ link EAS build lên điện thoại thật, đăng nhập bằng `EXPO_PUBLIC_API_URL` trỏ
      đúng backend Render
- [ ] Xoá mọi tài khoản/dữ liệu test tạo ra trong lúc kiểm tra
