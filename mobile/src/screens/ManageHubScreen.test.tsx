import { screen } from '@testing-library/react-native';
import ManageHubScreen from './ManageHubScreen';
import { renderWithQuery } from '../testing/renderWithQuery';
import { useAuth } from '../lib/auth';
import { ownerService } from '../services/owner.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/owner.service', () => ({
  ownerService: { stats: jest.fn(), reviews: jest.fn() },
}));

const mockAuth = useAuth as jest.Mock;
const mockStats = ownerService.stats as jest.Mock;
const mockReviews = ownerService.reviews as jest.Mock;

const signedInAs = (...roles: string[]) =>
  mockAuth.mockReturnValue({ user: { _id: 'u1', roles }, isLoading: false });

beforeEach(() => {
  jest.clearAllMocks();
  mockStats.mockResolvedValue({
    stats: { pendingBookings: 3, todayBookings: 2, monthRevenue: 1_500_000, activeFields: 1, totalFields: 2 },
  });
  mockReviews.mockResolvedValue({ reviews: [], unanswered: 0 });
});

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('ManageHubScreen', () => {
  it('chủ sân thấy số liệu sân và lối vào lịch đặt', async () => {
    signedInAs('user', 'field_owner');
    await renderWithQuery(<ManageHubScreen />);

    expect(await screen.findByText('3')).toBeTruthy();
    expect(screen.getByText('Lịch đặt sân')).toBeTruthy();
    expect(screen.getByText('Sân của tôi')).toBeTruthy();
  });

  // Con số này là lý do duy nhất để chủ sân mở khu quản lý ngay lúc đang bận.
  it('nút đánh giá đếm sẵn số chờ trả lời', async () => {
    signedInAs('field_owner');
    mockReviews.mockResolvedValue({ reviews: [], unanswered: 4 });
    await renderWithQuery(<ManageHubScreen />);

    expect(await screen.findByText('Đánh giá (4 chờ trả lời)')).toBeTruthy();
  });

  it('không còn đánh giá nào chờ thì nút không đeo số', async () => {
    signedInAs('field_owner');
    await renderWithQuery(<ManageHubScreen />);

    expect(await screen.findByText('Đánh giá')).toBeTruthy();
  });

  it('quản lý đội vào được lịch sân của đội', async () => {
    signedInAs('team_manager');
    await renderWithQuery(<ManageHubScreen />);

    expect(await screen.findByText('Lịch sân của đội')).toBeTruthy();
  });

  it('chủ sân không thấy khu quản lý đội', async () => {
    signedInAs('user', 'field_owner');
    await renderWithQuery(<ManageHubScreen />);

    expect(await screen.findByText('Quản lý sân')).toBeTruthy();
    expect(screen.queryByText('Quản lý đội bóng')).toBeNull();
  });

  it('quản lý đội thấy khu đội bóng, không thấy khu sân', async () => {
    signedInAs('user', 'team_manager');
    await renderWithQuery(<ManageHubScreen />);

    expect(await screen.findByText('Quản lý đội bóng')).toBeTruthy();
    expect(screen.queryByText('Quản lý sân')).toBeNull();
    expect(mockStats).not.toHaveBeenCalled();
  });

  it('admin thấy cả hai khu', async () => {
    signedInAs('user', 'admin');
    await renderWithQuery(<ManageHubScreen />);

    expect(await screen.findByText('Quản lý sân')).toBeTruthy();
    expect(screen.getByText('Quản lý đội bóng')).toBeTruthy();
  });

  it('tài khoản thường bị chặn ngay ở cửa', async () => {
    signedInAs('user');
    await renderWithQuery(<ManageHubScreen />);

    expect(screen.getByText('Tài khoản chưa có quyền quản lý')).toBeTruthy();
    expect(mockStats).not.toHaveBeenCalled();
  });
});
