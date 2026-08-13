import { screen } from '@testing-library/react-native';
import ManageHubScreen from './ManageHubScreen';
import { renderWithQuery } from '../testing/renderWithQuery';
import { useAuth } from '../lib/auth';
import { ownerService } from '../services/owner.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/owner.service', () => ({ ownerService: { stats: jest.fn() } }));

const mockAuth = useAuth as jest.Mock;
const mockStats = ownerService.stats as jest.Mock;

const signedInAs = (...roles: string[]) =>
  mockAuth.mockReturnValue({ user: { _id: 'u1', roles }, isLoading: false });

beforeEach(() => {
  jest.clearAllMocks();
  mockStats.mockResolvedValue({
    stats: { pendingBookings: 3, todayBookings: 2, monthRevenue: 1_500_000, activeFields: 1, totalFields: 2 },
  });
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
