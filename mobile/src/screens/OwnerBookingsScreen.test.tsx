import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { OwnerBooking } from '@fcp/shared';
import OwnerBookingsScreen from './OwnerBookingsScreen';
import { renderWithQuery } from '../testing/renderWithQuery';
import { useAuth } from '../lib/auth';
import { ownerService } from '../services/owner.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/owner.service', () => ({
  ownerService: {
    bookings: jest.fn(),
    confirmBooking: jest.fn(),
    completeBooking: jest.fn(),
    markNoShow: jest.fn(),
  },
}));
jest.mock('../services/booking.service', () => ({ bookingService: { cancel: jest.fn() } }));

const mockAuth = useAuth as jest.Mock;
const mockBookings = ownerService.bookings as jest.Mock;
const mockConfirm = ownerService.confirmBooking as jest.Mock;

const dayOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const booking = (overrides: Partial<OwnerBooking> = {}) =>
  ({
    _id: 'b1',
    status: 'pending',
    date: dayOffset(1),
    startTime: '18:00',
    endTime: '20:00',
    totalPrice: 300000,
    subFieldName: 'Sân số 1',
    field: { _id: 'f1', name: 'Sân Probe' },
    user: { _id: 'u9', fullName: 'Nguyễn Văn A' },
    ...overrides,
  }) as OwnerBooking;

const listReturns = (...items: OwnerBooking[]) =>
  mockBookings.mockResolvedValue({ bookings: items });

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { _id: 'u1', roles: ['field_owner'] }, isLoading: false });
  mockConfirm.mockResolvedValue({ booking: {} });
  listReturns(booking());
});

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('OwnerBookingsScreen', () => {
  it('mở ra là lọc sẵn đơn chờ xác nhận — đó là việc chủ sân cần làm ngay', async () => {
    await renderWithQuery(<OwnerBookingsScreen />);

    await waitFor(() =>
      expect(mockBookings).toHaveBeenCalledWith({ status: 'pending', limit: 50 })
    );
  });

  it('hiện tên khách, sân con và khung giờ', async () => {
    await renderWithQuery(<OwnerBookingsScreen />);

    expect(await screen.findByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.getByText(/Sân Probe · Sân số 1/)).toBeTruthy();
  });

  it('đơn chờ xác nhận có nút xác nhận và gọi đúng service', async () => {
    await renderWithQuery(<OwnerBookingsScreen />);

    fireEvent.press(await screen.findByText('Xác nhận'));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith('b1'));
  });

  // Chữ trên nút trùng với chip lọc trạng thái, nên tìm theo nhãn trợ năng của từng đơn.
  it('đơn đã xác nhận nhưng chưa tới giờ thì chưa cho đánh dấu vắng mặt', async () => {
    listReturns(booking({ status: 'confirmed', date: dayOffset(1) }));
    await renderWithQuery(<OwnerBookingsScreen />);

    expect(await screen.findByLabelText('Hoàn thành lịch của Nguyễn Văn A')).toBeTruthy();
    expect(screen.queryByLabelText('Đánh dấu Nguyễn Văn A không đến')).toBeNull();
  });

  it('qua giờ đá rồi mới hiện nút khách không đến', async () => {
    listReturns(booking({ status: 'confirmed', date: dayOffset(-1) }));
    await renderWithQuery(<OwnerBookingsScreen />);

    expect(await screen.findByLabelText('Đánh dấu Nguyễn Văn A không đến')).toBeTruthy();
  });

  it('đơn đã hoàn thành thì không còn thao tác nào', async () => {
    listReturns(booking({ status: 'completed', date: dayOffset(-2) }));
    await renderWithQuery(<OwnerBookingsScreen />);

    expect(await screen.findByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.queryByText('Xác nhận')).toBeNull();
    expect(screen.queryByText('Huỷ lịch')).toBeNull();
  });

  it('không có đơn nào thì chỉ đường sang bộ lọc khác', async () => {
    listReturns();
    await renderWithQuery(<OwnerBookingsScreen />);

    expect(await screen.findByText('Không có lịch đặt nào')).toBeTruthy();
  });

  it('tài khoản thường không vào được', async () => {
    mockAuth.mockReturnValue({ user: { _id: 'u1', roles: ['user'] }, isLoading: false });
    await renderWithQuery(<OwnerBookingsScreen />);

    expect(screen.getByText('Tài khoản chưa phải chủ sân')).toBeTruthy();
    expect(mockBookings).not.toHaveBeenCalled();
  });
});
