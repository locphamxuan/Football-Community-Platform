jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/models/Booking', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../../src/models/Field', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../src/models/Team', () => ({ findOne: jest.fn() }));

const Booking = require('../../src/models/Booking');
const Field = require('../../src/models/Field');
const bookingService = require('../../src/services/booking.service');

const OWNER_ID = '000000000000000000000002';
const BOOKER_ID = '000000000000000000000001';
const FIELD_ID = '000000000000000000000010';
const BOOKING_ID = '000000000000000000000020';
const ADMIN_ID = '000000000000000000000009';

const HOUR = 3600000;

/** Ngày YYYY-MM-DD cách hiện tại `offsetMs`, tính theo UTC như service. */
const dateAt = (offsetMs) => new Date(Date.now() + offsetMs).toISOString().slice(0, 10);

/** Giờ HH:mm của mốc thời gian, tính theo UTC như service. */
const timeAt = (offsetMs) => new Date(Date.now() + offsetMs).toISOString().slice(11, 16);

const makeBooking = (overrides = {}) => ({
  _id: BOOKING_ID,
  user: { toString: () => BOOKER_ID },
  field: FIELD_ID,
  date: `${dateAt(0)}T00:00:00.000Z`,
  startTime: '23:00',
  status: 'confirmed',
  ...overrides,
});

/** Booking bắt đầu sau `hours` giờ nữa. */
const bookingStartingIn = (hours, overrides = {}) => makeBooking({
  date: `${dateAt(hours * HOUR)}T00:00:00.000Z`,
  startTime: timeAt(hours * HOUR),
  ...overrides,
});

const mockField = (owner = OWNER_ID) => {
  Field.findById.mockReturnValue({ select: () => Promise.resolve({ _id: FIELD_ID, owner: { toString: () => owner }, name: 'Sân Probe' }) });
};

const mockUpdateReturns = (value) => {
  Booking.findByIdAndUpdate.mockReturnValue({ populate: () => Promise.resolve(value) });
};

beforeEach(() => {
  mockField();
  mockUpdateReturns({ _id: BOOKING_ID, status: 'cancelled' });
});

describe('cancelBooking — cửa sổ huỷ 2 tiếng', () => {
  it('người đặt huỷ được khi còn hơn 2 tiếng', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(5));

    await expect(bookingService.cancelBooking(BOOKING_ID, BOOKER_ID, 'Bận')).resolves.toBeDefined();
    expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
      BOOKING_ID, expect.objectContaining({ status: 'cancelled', cancelReason: 'Bận' }), { new: true }
    );
  });

  it('người đặt không huỷ được khi chỉ còn 1 tiếng', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(1));

    await expect(bookingService.cancelBooking(BOOKING_ID, BOOKER_ID, 'Bận'))
      .rejects.toMatchObject({ statusCode: 400, code: 'BOOKING_NOT_CANCELLABLE' });
    expect(Booking.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('admin huỷ được sát giờ đá', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(0.5));

    await expect(bookingService.cancelBooking(BOOKING_ID, ADMIN_ID, 'Sân ngập', true)).resolves.toBeDefined();
  });

  it('chủ sân từ chối được sát giờ đá', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(0.5));

    await expect(bookingService.cancelBooking(BOOKING_ID, OWNER_ID, 'Sân hỏng')).resolves.toBeDefined();
  });

  it('người lạ không đụng được vào đơn của người khác', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(5));

    await expect(bookingService.cancelBooking(BOOKING_ID, 'nguoi-la', 'Thử'))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it.each(['cancelled', 'completed', 'no_show'])('đơn đã ở trạng thái %s thì không huỷ lại được', async (status) => {
    Booking.findById.mockResolvedValue(bookingStartingIn(5, { status }));

    await expect(bookingService.cancelBooking(BOOKING_ID, BOOKER_ID, 'Thử'))
      .rejects.toMatchObject({ code: 'BOOKING_NOT_CANCELLABLE' });
  });

  it('đơn không tồn tại trả 404', async () => {
    Booking.findById.mockResolvedValue(null);

    await expect(bookingService.cancelBooking(BOOKING_ID, BOOKER_ID, 'Thử'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('confirmBooking', () => {
  it('chỉ xác nhận đơn đang chờ', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(5, { status: 'pending' }));
    mockUpdateReturns({ status: 'confirmed' });

    await expect(bookingService.confirmBooking(BOOKING_ID, OWNER_ID)).resolves.toMatchObject({ status: 'confirmed' });
  });

  it('đơn đã xác nhận không xác nhận lại', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(5, { status: 'confirmed' }));

    await expect(bookingService.confirmBooking(BOOKING_ID, OWNER_ID)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('chủ sân khác không xác nhận hộ được', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(5, { status: 'pending' }));

    await expect(bookingService.confirmBooking(BOOKING_ID, 'chu-san-khac')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('completeBooking', () => {
  it('chỉ hoàn thành đơn đã xác nhận và đã qua giờ đá', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(-2, { status: 'confirmed' }));
    mockUpdateReturns({ status: 'completed' });

    await expect(bookingService.completeBooking(BOOKING_ID, OWNER_ID)).resolves.toMatchObject({ status: 'completed' });
    // Đếm lượt đặt của sân chỉ tăng khi trận thực sự diễn ra
    expect(Field.findByIdAndUpdate).toHaveBeenCalledWith(FIELD_ID, { $inc: { totalBookings: 1 } });
  });

  it('không hoàn thành trận chưa diễn ra', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(3, { status: 'confirmed' }));

    await expect(bookingService.completeBooking(BOOKING_ID, OWNER_ID)).rejects.toMatchObject({ statusCode: 400 });
    expect(Field.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('đơn chưa xác nhận thì không hoàn thành được', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(-2, { status: 'pending' }));

    await expect(bookingService.completeBooking(BOOKING_ID, OWNER_ID)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('markNoShow', () => {
  it('đánh dấu được sau giờ bắt đầu', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(-1, { status: 'confirmed' }));
    Booking.findByIdAndUpdate.mockResolvedValue({ status: 'no_show' });

    await expect(bookingService.markNoShow(BOOKING_ID, OWNER_ID)).resolves.toMatchObject({ status: 'no_show' });
  });

  it('không đánh dấu trước giờ bắt đầu — khách còn có thể tới', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(2, { status: 'confirmed' }));

    await expect(bookingService.markNoShow(BOOKING_ID, OWNER_ID)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('đơn chưa xác nhận thì không đánh dấu vắng mặt', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(-1, { status: 'pending' }));

    await expect(bookingService.markNoShow(BOOKING_ID, OWNER_ID)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('dayRangeUtc', () => {
  it('cắt đúng mốc nửa đêm UTC bất kể múi giờ server', () => {
    const { start, end } = bookingService.dayRangeUtc('2026-08-10');

    expect(start.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-11T00:00:00.000Z');
  });

  it('bỏ phần giờ của mốc thời gian đầu vào', () => {
    const { start } = bookingService.dayRangeUtc('2026-08-10T17:45:00.000Z');

    expect(start.toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });
});
