// Thông báo có test riêng ở notification.service.test.js; ở đây chỉ cần nó không chạm Mongo.
jest.mock('../../src/services/notification.service');
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
const Team = require('../../src/models/Team');
const { notify } = require('../../src/services/notification.service');
const bookingService = require('../../src/services/booking.service');

const OWNER_ID = '000000000000000000000002';
const BOOKER_ID = '000000000000000000000001';
const FIELD_ID = '000000000000000000000010';
const BOOKING_ID = '000000000000000000000020';
const ADMIN_ID = '000000000000000000000009';
const SUBFIELD_ID = '000000000000000000000030';
const TEAM_ID = '000000000000000000000040';

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
  endTime: '23:30',
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

describe('thông báo đi kèm sự kiện đặt sân', () => {
  /** Đối số của lần gọi notify duy nhất trong một thao tác. */
  const notifyCall = () => {
    const [recipient, payload, actorId] = notify.mock.calls[0];
    return { recipient: recipient.toString(), payload, actorId };
  };

  it('người đặt huỷ thì chủ sân được báo, kèm lý do', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(5));

    await bookingService.cancelBooking(BOOKING_ID, BOOKER_ID, 'Bận việc');

    const { recipient, payload, actorId } = notifyCall();
    expect(recipient).toBe(OWNER_ID);
    expect(payload).toMatchObject({ type: 'booking_cancelled', link: '/owner/bookings' });
    expect(payload.body).toContain('Bận việc');
    expect(actorId).toBe(BOOKER_ID);
  });

  it('chủ sân từ chối thì người đặt được báo', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(0.5));

    await bookingService.cancelBooking(BOOKING_ID, OWNER_ID, 'Sân hỏng');

    const { recipient, payload } = notifyCall();
    expect(recipient).toBe(BOOKER_ID);
    expect(payload).toMatchObject({ type: 'booking_cancelled', link: '/bookings' });
  });

  it('xác nhận lịch thì người đặt được báo', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(5, { status: 'pending' }));
    mockUpdateReturns({ status: 'confirmed' });

    await bookingService.confirmBooking(BOOKING_ID, OWNER_ID);

    const { recipient, payload, actorId } = notifyCall();
    expect(recipient).toBe(BOOKER_ID);
    expect(payload).toMatchObject({ type: 'booking_confirmed', link: '/bookings' });
    expect(payload.body).toContain('Sân Probe');
    expect(actorId).toBe(OWNER_ID);
  });

  it('thao tác thất bại thì không bắn thông báo nào', async () => {
    Booking.findById.mockResolvedValue(bookingStartingIn(1));

    await expect(bookingService.cancelBooking(BOOKING_ID, BOOKER_ID, 'Bận')).rejects.toBeDefined();

    expect(notify).not.toHaveBeenCalled();
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

describe('createBooking', () => {
  const validData = (overrides = {}) => ({
    fieldId: FIELD_ID,
    subFieldId: SUBFIELD_ID,
    date: new Date(Date.now() + 2 * HOUR * 24).toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '11:00',
    ...overrides,
  });

  const makeField = ({ subField = { _id: SUBFIELD_ID, status: 'available' }, ...overrides } = {}) => ({
    _id: FIELD_ID,
    owner: OWNER_ID,
    name: 'Sân Probe',
    status: 'active',
    isVerified: true,
    operatingHours: { open: '06:00', close: '23:00' },
    pricing: {
      weekday: { morning: 100000, afternoon: 150000, evening: 200000 },
      weekend: { morning: 120000, afternoon: 180000, evening: 240000 },
    },
    subFields: { id: () => subField },
    ...overrides,
  });

  beforeEach(() => {
    Field.findById.mockResolvedValue(makeField());
    Booking.countDocuments.mockResolvedValue(0);
    Booking.create.mockResolvedValue({ _id: BOOKING_ID, deleteOne: jest.fn().mockResolvedValue(undefined) });
  });

  it('sân không tồn tại thì báo 404', async () => {
    Field.findById.mockResolvedValue(null);

    await expect(bookingService.createBooking(BOOKER_ID, validData()))
      .rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('sân không active thì không đặt được', async () => {
    Field.findById.mockResolvedValue(makeField({ status: 'maintenance' }));

    await expect(bookingService.createBooking(BOOKER_ID, validData()))
      .rejects.toMatchObject({ statusCode: 400, code: 'FIELD_NOT_ACTIVE' });
  });

  it('sân chưa được xác thực thì không đặt được', async () => {
    Field.findById.mockResolvedValue(makeField({ isVerified: false }));

    await expect(bookingService.createBooking(BOOKER_ID, validData()))
      .rejects.toMatchObject({ statusCode: 400, code: 'FIELD_NOT_VERIFIED' });
  });

  it('sân con không tồn tại thì báo 404', async () => {
    Field.findById.mockResolvedValue(makeField({ subField: null }));

    await expect(bookingService.createBooking(BOOKER_ID, validData()))
      .rejects.toMatchObject({ statusCode: 404, code: 'SUBFIELD_NOT_FOUND' });
  });

  it('sân con không ở trạng thái available thì không đặt được', async () => {
    Field.findById.mockResolvedValue(makeField({ subField: { _id: SUBFIELD_ID, status: 'maintenance' } }));

    await expect(bookingService.createBooking(BOOKER_ID, validData()))
      .rejects.toMatchObject({ statusCode: 400, code: 'SLOT_NOT_AVAILABLE' });
  });

  it('đặt ngoài giờ mở cửa của sân thì bị từ chối', async () => {
    await expect(bookingService.createBooking(BOOKER_ID, validData({ startTime: '05:00', endTime: '06:00' })))
      .rejects.toMatchObject({ statusCode: 400, code: 'SLOT_NOT_AVAILABLE' });
  });

  it.each([
    ['15:00', '15:15', 'ngắn hơn 0.5 tiếng'],
    ['15:00', '22:00', 'dài hơn 6 tiếng'],
  ])('thời lượng %s–%s (%s) nằm ngoài khoảng cho phép thì bị từ chối', async (startTime, endTime) => {
    await expect(bookingService.createBooking(BOOKER_ID, validData({ startTime, endTime })))
      .rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('không đặt được khung giờ đã trôi qua', async () => {
    const past = new Date(Date.now() - HOUR * 24);
    await expect(bookingService.createBooking(BOOKER_ID, validData({
      date: past.toISOString().slice(0, 10),
      startTime: '10:00',
      endTime: '11:00',
    }))).rejects.toMatchObject({ statusCode: 400, code: 'SLOT_NOT_AVAILABLE' });
  });

  it('đặt hộ đội mà mình không phải thành viên thì bị từ chối', async () => {
    Team.findOne.mockReturnValue({ select: () => Promise.resolve(null) });

    await expect(bookingService.createBooking(BOOKER_ID, validData({ teamId: TEAM_ID })))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(Booking.create).not.toHaveBeenCalled();
  });

  it('khung giờ đã có người đặt thì báo 409, không tạo booking', async () => {
    Booking.countDocuments.mockResolvedValueOnce(1);

    await expect(bookingService.createBooking(BOOKER_ID, validData()))
      .rejects.toMatchObject({ statusCode: 409, code: 'SLOT_NOT_AVAILABLE' });
    expect(Booking.create).not.toHaveBeenCalled();
  });

  it('hai request cùng đặt một khung giờ — request thua cuộc bị hoàn tác sau khi ghi', async () => {
    const deleteOne = jest.fn().mockResolvedValue(undefined);
    Booking.create.mockResolvedValue({ _id: BOOKING_ID, deleteOne });
    Booking.countDocuments
      .mockResolvedValueOnce(0) // còn trống lúc kiểm tra đầu
      .mockResolvedValueOnce(1); // đã có người khác chen vào trước khi ghi xong

    await expect(bookingService.createBooking(BOOKER_ID, validData()))
      .rejects.toMatchObject({ statusCode: 409, code: 'SLOT_NOT_AVAILABLE' });
    expect(deleteOne).toHaveBeenCalled();
  });

  it('tạo booking thành công, tính đúng giá theo khung giờ và báo cho chủ sân', async () => {
    const finalBooking = { _id: BOOKING_ID, status: 'pending' };
    Booking.findById.mockReturnValue({ populate: () => Promise.resolve(finalBooking) });
    const data = validData({ startTime: '10:00', endTime: '11:00' });
    const isWeekend = [0, 6].includes(new Date(data.date).getUTCDay());
    const expectedPrice = isWeekend ? 120000 : 100000; // "morning" rate, đơn giá 1 tiếng

    const result = await bookingService.createBooking(BOOKER_ID, data);

    expect(result).toBe(finalBooking);
    expect(Booking.create).toHaveBeenCalledWith(expect.objectContaining({
      field: FIELD_ID,
      duration: 1,
      totalPrice: expectedPrice,
      paymentMethod: 'cash',
    }));
    const [recipient, payload, actorId] = notify.mock.calls[0];
    expect(recipient).toBe(OWNER_ID);
    expect(payload).toMatchObject({ type: 'booking_created', link: '/owner/bookings' });
    expect(actorId).toBe(BOOKER_ID);
  });

  it('đặt hộ đội mà mình là thành viên thì thành công', async () => {
    Team.findOne.mockReturnValue({ select: () => Promise.resolve({ _id: TEAM_ID }) });
    Booking.findById.mockReturnValue({ populate: () => Promise.resolve({ _id: BOOKING_ID }) });

    await expect(bookingService.createBooking(BOOKER_ID, validData({ teamId: TEAM_ID }))).resolves.toBeDefined();
    expect(Booking.create).toHaveBeenCalledWith(expect.objectContaining({ team: expect.anything() }));
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
