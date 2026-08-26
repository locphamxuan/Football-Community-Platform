jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/booking');

const request = require('supertest');
const app = require('../../src/app');
const bookingService = require('../../src/services/booking');
const { asUser, asOwner, asAdmin, USER_ID } = require('../helpers/auth');

const BOOKING_ID = '000000000000000000000020';
const FIELD_ID = '000000000000000000000010';
const SUB_FIELD_ID = '000000000000000000000011';

const emptyPage = { bookings: [], total: 0, page: 1, limit: 10 };

/** Ngày trong tương lai để không dính rule "không đặt sân ngày đã qua". */
const futureDate = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

const validBooking = () => ({
  fieldId: FIELD_ID,
  subFieldId: SUB_FIELD_ID,
  date: futureDate(),
  startTime: '18:00',
  endTime: '20:00',
});

describe('toàn bộ /api/v1/bookings cần đăng nhập', () => {
  it.each([
    ['post', '/api/v1/bookings'],
    ['get', '/api/v1/bookings/my-bookings'],
    ['get', '/api/v1/bookings/team/bookings'],
    ['get', '/api/v1/bookings/owner/bookings'],
    ['get', '/api/v1/bookings/owner/stats'],
    ['get', '/api/v1/bookings/owner/revenue'],
    ['get', `/api/v1/bookings/${BOOKING_ID}`],
    ['patch', `/api/v1/bookings/${BOOKING_ID}/cancel`],
    ['patch', `/api/v1/bookings/${BOOKING_ID}/confirm`],
  ])('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/bookings', () => {
  it('tạo đơn đặt sân', async () => {
    bookingService.createBooking.mockResolvedValue({ _id: BOOKING_ID, totalPrice: 600000 });

    const res = await request(app).post('/api/v1/bookings').set(asUser()).send(validBooking());

    expect(res.status).toBe(201);
    expect(res.body.data.booking.totalPrice).toBe(600000);
    expect(bookingService.createBooking).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ fieldId: FIELD_ID }));
  });

  it.each([
    ['thiếu sân con', { subFieldId: undefined }],
    ['ngày đã qua', { date: '2020-01-01' }],
    ['ngày sai định dạng', { date: '01/09/2026' }],
    ['giờ kết thúc trước giờ bắt đầu', { startTime: '20:00', endTime: '18:00' }],
    ['giờ kết thúc bằng giờ bắt đầu', { startTime: '18:00', endTime: '18:00' }],
    ['giờ sai định dạng', { startTime: '25:00' }],
    ['phương thức thanh toán lạ', { paymentMethod: 'crypto' }],
  ])('từ chối khi %s', async (_label, patch) => {
    const body = { ...validBooking(), ...patch };
    if (patch.subFieldId === undefined) delete body.subFieldId;

    const res = await request(app).post('/api/v1/bookings').set(asUser()).send(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(bookingService.createBooking).not.toHaveBeenCalled();
  });
});

describe('danh sách lịch đặt', () => {
  it('GET /my-bookings trả kèm phân trang', async () => {
    bookingService.getMyBookings.mockResolvedValue({ bookings: [], total: 25, page: 2, limit: 10 });

    const res = await request(app).get('/api/v1/bookings/my-bookings').query({ page: 2 }).set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.meta.pagination).toMatchObject({ total: 25, page: 2, totalPages: 3, hasNextPage: true });
  });

  it('GET /team/bookings không bị route /:id nuốt mất', async () => {
    bookingService.getTeamBookings.mockResolvedValue(emptyPage);

    const res = await request(app).get('/api/v1/bookings/team/bookings').set(asUser());

    expect(res.status).toBe(200);
    expect(bookingService.getTeamBookings).toHaveBeenCalled();
    expect(bookingService.getBookingById).not.toHaveBeenCalled();
  });

  it('GET /team/bookings từ chối query sai định dạng', async () => {
    const res = await request(app)
      .get('/api/v1/bookings/team/bookings')
      .query({ startDate: '10-08-2026' })
      .set(asUser());

    expect(res.status).toBe(400);
  });
});

describe('khu chủ sân', () => {
  it.each([
    '/api/v1/bookings/owner/bookings',
    '/api/v1/bookings/owner/stats',
    '/api/v1/bookings/owner/revenue',
  ])('%s từ chối người dùng thường', async (url) => {
    const res = await request(app).get(url).set(asUser());
    expect(res.status).toBe(403);
  });

  it('GET /owner/bookings trả lịch của mọi sân', async () => {
    bookingService.getOwnerBookings.mockResolvedValue(emptyPage);

    const res = await request(app).get('/api/v1/bookings/owner/bookings').set(asOwner());

    expect(res.status).toBe(200);
    expect(bookingService.getOwnerBookings).toHaveBeenCalledWith(USER_ID, expect.any(Object));
  });

  it('GET /owner/stats trả số liệu tổng quan', async () => {
    bookingService.getOwnerStats.mockResolvedValue({ totalFields: 2, monthRevenue: 1000000 });

    const res = await request(app).get('/api/v1/bookings/owner/stats').set(asOwner());

    expect(res.status).toBe(200);
    expect(res.body.data.stats.monthRevenue).toBe(1000000);
  });

  it('GET /owner/revenue giới hạn số tháng tối đa 24', async () => {
    const res = await request(app).get('/api/v1/bookings/owner/revenue').query({ months: 36 }).set(asOwner());

    expect(res.status).toBe(400);
    expect(bookingService.getOwnerRevenueSeries).not.toHaveBeenCalled();
  });

  it('GET /owner/revenue chấp nhận số tháng hợp lệ', async () => {
    bookingService.getOwnerRevenueSeries.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/bookings/owner/revenue').query({ months: 12 }).set(asOwner());

    expect(res.status).toBe(200);
    expect(bookingService.getOwnerRevenueSeries).toHaveBeenCalledWith(USER_ID, 12);
  });

  it('GET /field/:fieldId chỉ dành cho chủ sân', async () => {
    const res = await request(app).get(`/api/v1/bookings/field/${FIELD_ID}`).set(asUser());
    expect(res.status).toBe(403);
  });

  it('GET /field/:fieldId trả lịch đặt của sân đó', async () => {
    bookingService.getFieldBookings.mockResolvedValue(emptyPage);

    const res = await request(app).get(`/api/v1/bookings/field/${FIELD_ID}`).set(asOwner());

    expect(res.status).toBe(200);
    expect(bookingService.getFieldBookings).toHaveBeenCalledWith(FIELD_ID, USER_ID, expect.any(Object), false);
  });
});

describe('GET /api/v1/bookings/:id', () => {
  it('trả chi tiết một đơn đặt sân', async () => {
    bookingService.getBookingById.mockResolvedValue({ _id: BOOKING_ID, status: 'confirmed' });

    const res = await request(app).get(`/api/v1/bookings/${BOOKING_ID}`).set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data.booking._id).toBe(BOOKING_ID);
    expect(bookingService.getBookingById).toHaveBeenCalledWith(BOOKING_ID, USER_ID, false);
  });
});

describe('vòng đời một đơn đặt sân', () => {
  it('người đặt huỷ đơn kèm lý do', async () => {
    bookingService.cancelBooking.mockResolvedValue({ status: 'cancelled' });

    const res = await request(app)
      .patch(`/api/v1/bookings/${BOOKING_ID}/cancel`)
      .set(asUser())
      .send({ reason: 'Bận đột xuất' });

    expect(res.status).toBe(200);
    expect(bookingService.cancelBooking).toHaveBeenCalledWith(BOOKING_ID, USER_ID, 'Bận đột xuất', false);
  });

  it('huỷ đơn bắt buộc có lý do', async () => {
    const res = await request(app).patch(`/api/v1/bookings/${BOOKING_ID}/cancel`).set(asUser()).send({});

    expect(res.status).toBe(400);
    expect(bookingService.cancelBooking).not.toHaveBeenCalled();
  });

  it('admin huỷ đơn thì service nhận cờ isAdmin', async () => {
    bookingService.cancelBooking.mockResolvedValue({ status: 'cancelled' });

    await request(app)
      .patch(`/api/v1/bookings/${BOOKING_ID}/cancel`)
      .set(asAdmin())
      .send({ reason: 'Sân bảo trì' });

    expect(bookingService.cancelBooking).toHaveBeenCalledWith(BOOKING_ID, USER_ID, 'Sân bảo trì', true);
  });

  it.each([
    ['confirm', 'confirmBooking', 'Booking confirmed'],
    ['complete', 'completeBooking', 'Booking completed'],
    ['no-show', 'markNoShow', 'Booking marked as no-show'],
  ])('chủ sân %s được đơn', async (action, method, message) => {
    bookingService[method].mockResolvedValue({ _id: BOOKING_ID });

    const res = await request(app).patch(`/api/v1/bookings/${BOOKING_ID}/${action}`).set(asOwner());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(message);
    expect(bookingService[method]).toHaveBeenCalledWith(BOOKING_ID, USER_ID, false);
  });

  it.each(['confirm', 'complete', 'no-show'])('người dùng thường không %s được đơn', async (action) => {
    const res = await request(app).patch(`/api/v1/bookings/${BOOKING_ID}/${action}`).set(asUser());
    expect(res.status).toBe(403);
  });
});
