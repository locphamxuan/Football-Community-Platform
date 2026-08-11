# 06 — Kiểm thử

**Mỗi phía có test runner riêng. Code làm đổi hành vi thì đi kèm test.**

| Phía | Công cụ | Lệnh | Số test |
|---|---|---|---|
| `backend/` | Jest + supertest | `npm test` | 497 |
| `frontend/` | Vitest + Testing Library | `npm test` | 37 |
| `mobile/` | Jest + jest-expo + Testing Library RN | `npm test` | 15 |

## Backend

```
tests/
  helpers/
    auth.js          token thật cho từng vai trò
    fakeRedis.js     Redis trong RAM
  unit/              logic thuần và quy tắc nghiệp vụ (model được mock)
  integration/       HTTP qua supertest (service được mock, không chạm MongoDB)
  setupEnv.js        biến môi trường giả, nạp trước mọi module
```

### Không có cơ sở dữ liệu trong test

Test không mở kết nối MongoDB hay Redis. Hai kỹ thuật:

**Test HTTP** mock tầng service (`jest.mock('../../src/services/booking.service')`) rồi bắn
request thật qua supertest. Nhờ vậy toàn bộ chuỗi middleware — xác thực, phân quyền, upload,
`parseJsonFields`, Zod, error handler — chạy y như production, còn tầng dữ liệu thì không cần.

**Test service** mock model Mongoose bằng object phẳng chỉ có những phương thức service gọi tới:

```js
jest.mock('../../src/models/Booking', () => ({
  findById: jest.fn(), findByIdAndUpdate: jest.fn(), countDocuments: jest.fn(), create: jest.fn(),
}));
```

Truy vấn nào có chuỗi (`.select()`, `.populate()`, `.sort()`, `.lean()`) thì mock trả về object
chứa đúng phương thức tiếp theo.

### Token trong test là token thật

`tests/helpers/auth.js` ký JWT bằng đúng secret của test, nên `authenticate` chạy đầy đủ —
không mock middleware xác thực. `asUser()`, `asOwner()`, `asAdmin()` trả về header sẵn dùng:

```js
const res = await request(app).get('/api/v1/admin/overview').set(asAdmin());
```

### Redis giả

```js
jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
```

Một `Map` trong RAM, `CacheKeys`/`CacheTTL` lấy từ module thật qua `jest.requireActual` nên
không bao giờ lệch. `getRedisClient` cố tình ném lỗi — test nào chạm tới nó là test đó đang
mở kết nối thật.

### Mỗi endpoint được kiểm ba lớp

1. **Cổng xác thực** — không token thì 401.
2. **Cổng phân quyền** — sai vai trò thì 403.
3. **Hợp đồng dữ liệu** — body/query sai thì 400, và service **không** được gọi.

Cộng thêm đường đi thành công: đúng mã HTTP, đúng khuôn dạng response, và service nhận đúng
tham số. Toàn bộ `routes/`, `controllers/`, `middleware/` và `validations/` đạt 100% statement.

## Frontend

Test nằm cạnh file nó kiểm (`format.test.ts` bên cạnh `format.ts`).

- `src/lib/format.test.ts` — định dạng tiền, ngày, giờ theo tiếng Việt
- `src/components/dashboard/*.test.tsx` — các trạng thái component thật sự render
- `src/services/api.test.ts` — interceptor của axios: gắn token, tự làm mới khi 401, hàng đợi
- `src/stores/authStore.test.ts` — token vào `sessionStorage`, không lọt vào `localStorage`

Test interceptor **thay `api.defaults.adapter`** thay vì mock cả axios, nên logic thật sự
được chạy qua. Cách này đã tìm ra một lỗi treo request khi chính lời gọi refresh trả 401.

## Mobile

**`render()` của RNTL 14 là bất đồng bộ — luôn `await`.** Quên `await` thì `screen` rỗng và
lỗi báo rất khó hiểu ("render function has not been called").

`jest-expo` cần gói `test-renderer`, không phải `react-test-renderer`.

## Nên test gì

Logic thuần (giá, Elo, ngày giờ, định dạng), schema validation **kèm cả trường hợp bị từ chối**,
cổng phân quyền, và các trạng thái một component thật sự render (đang tải, rỗng, lỗi, có dữ liệu).

Không test thư viện của người khác, và không chạy theo con số coverage.

## Chạy

```bash
cd backend  && npm test              # toàn bộ
cd backend  && npm run test:coverage
cd backend  && npx jest tests/unit/booking.service.test.js   # một file
cd frontend && npm test -- --run
cd mobile   && npm test
```

Backend đặt `maxWorkers: 2`: mỗi worker nạp cả express lẫn mongoose, để jest tự chọn theo số
nhân CPU thì máy dev hết RAM và worker bị giết giữa chừng ("JavaScript heap out of memory").
