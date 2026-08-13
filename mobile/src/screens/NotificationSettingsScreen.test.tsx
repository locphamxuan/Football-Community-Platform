import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { User } from '@fcp/shared';
import NotificationSettingsScreen from './NotificationSettingsScreen';
import { renderWithQuery } from '../testing/renderWithQuery';
import { useAuth } from '../lib/auth';
import { userService } from '../services/user.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/user.service', () => ({
  userService: { updateNotificationPrefs: jest.fn() },
}));

const mockAuth = useAuth as jest.Mock;
const mockUpdate = userService.updateNotificationPrefs as jest.Mock;

const refreshUser = jest.fn();

const signedInWith = (notifications: User['notifications']) => {
  mockAuth.mockReturnValue({
    user: { _id: 'u1', fullName: 'Probe', notifications },
    isLoading: false,
    refreshUser,
  });
};

/**
 * Chờ mutation chạy xong hẳn. Chỉ chờ tới lúc service được gọi là kết thúc test giữa chừng:
 * lần render sau đó rơi ra ngoài `act()` và cảnh báo hiện lên ở test kế tiếp, rất khó lần ra.
 */
const settled = () =>
  waitFor(() => {
    expect(refreshUser).toHaveBeenCalled();
    // Công tắc bật lại nghĩa là lần render sau khi mutation xong đã chạy.
    expect(screen.getByLabelText('Hoá đơn mới').props.disabled).toBe(false);
  });

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
const renderScreen = () => renderWithQuery(<NotificationSettingsScreen />);

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({ user: {} });
  signedInWith({ push: true, mutedTypes: [] });
});

describe('NotificationSettingsScreen', () => {
  it('không tắt loại nào thì mọi công tắc đều bật', async () => {
    await renderScreen();

    expect(screen.getByLabelText('Hoá đơn mới').props.value).toBe(true);
    expect(screen.getByLabelText('Lịch đặt mới').props.value).toBe(true);
  });

  it('loại nằm trong mutedTypes hiện ở trạng thái tắt', async () => {
    signedInWith({ push: true, mutedTypes: ['invoice_issued'] });
    await renderScreen();

    expect(screen.getByLabelText('Hoá đơn mới').props.value).toBe(false);
    expect(screen.getByLabelText('Lịch đặt mới').props.value).toBe(true);
  });

  it('tắt một loại gửi lên cả danh sách chứ không phải phần thêm', async () => {
    signedInWith({ push: true, mutedTypes: ['booking_created'] });
    await renderScreen();

    fireEvent(screen.getByLabelText('Hoá đơn mới'), 'valueChange', false);

    await settled();
    expect(mockUpdate).toHaveBeenCalledWith({
      mutedTypes: ['booking_created', 'invoice_issued'],
    });
  });

  it('bật lại một loại thì gỡ nó khỏi danh sách, giữ nguyên loại khác', async () => {
    signedInWith({ push: true, mutedTypes: ['booking_created', 'invoice_issued'] });
    await renderScreen();

    fireEvent(screen.getByLabelText('Hoá đơn mới'), 'valueChange', true);

    await settled();
    expect(mockUpdate).toHaveBeenCalledWith({ mutedTypes: ['booking_created'] });
  });

  it('công tắc đẩy gửi riêng, không kèm danh sách loại', async () => {
    await renderScreen();

    fireEvent(screen.getByLabelText('Gửi thông báo tới điện thoại'), 'valueChange', false);

    await settled();
    expect(mockUpdate).toHaveBeenCalledWith({ push: false });
  });

  it('chưa đăng nhập thì mời đăng nhập thay vì hiện công tắc', async () => {
    mockAuth.mockReturnValue({ user: null, isLoading: false, refreshUser: jest.fn() });
    await renderScreen();

    expect(screen.getByText('Cần đăng nhập')).toBeTruthy();
    expect(screen.queryByLabelText('Hoá đơn mới')).toBeNull();
  });
});
