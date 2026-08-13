import { screen } from '@testing-library/react-native';
import type { TeamBooking } from '@fcp/shared';
import TeamBookingsScreen from './TeamBookingsScreen';
import { renderWithQuery } from '../testing/renderWithQuery';
import { useAuth } from '../lib/auth';
import { bookingService } from '../services/booking.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/booking.service', () => ({
  bookingService: { teamBookings: jest.fn() },
}));

const mockAuth = useAuth as jest.Mock;
const mockTeamBookings = bookingService.teamBookings as jest.Mock;

const booking = (overrides: Partial<TeamBooking> = {}) =>
  ({
    _id: 'b1',
    status: 'confirmed',
    date: '2026-08-20T00:00:00.000Z',
    startTime: '18:00',
    endTime: '20:00',
    totalPrice: 300000,
    field: { _id: 'f1', name: 'Sân Probe' },
    team: { _id: 't1', name: 'FC Probe' },
    user: { fullName: 'Nguyễn Văn A' },
    ...overrides,
  }) as TeamBooking;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { _id: 'u1', roles: ['team_manager'] }, isLoading: false });
  mockTeamBookings.mockResolvedValue({ bookings: [booking()] });
});

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('TeamBookingsScreen', () => {
  it('hiện tên đội, sân, khung giờ và người đã đặt', async () => {
    await renderWithQuery(<TeamBookingsScreen />);

    expect(await screen.findByText('FC Probe')).toBeTruthy();
    expect(screen.getByText('Sân Probe')).toBeTruthy();
    expect(screen.getByText('20/08/2026 · 18:00–20:00')).toBeTruthy();
    expect(screen.getByText('Người đặt: Nguyễn Văn A')).toBeTruthy();
  });

  it('đội chưa đặt sân nào thì chỉ cách tạo lịch', async () => {
    mockTeamBookings.mockResolvedValue({ bookings: [] });
    await renderWithQuery(<TeamBookingsScreen />);

    expect(await screen.findByText('Đội chưa có lịch sân nào')).toBeTruthy();
  });

  it('người chơi thường không vào được', async () => {
    mockAuth.mockReturnValue({ user: { _id: 'u1', roles: ['user'] }, isLoading: false });
    await renderWithQuery(<TeamBookingsScreen />);

    expect(screen.getByText('Chưa dẫn dắt đội nào')).toBeTruthy();
    expect(mockTeamBookings).not.toHaveBeenCalled();
  });
});
