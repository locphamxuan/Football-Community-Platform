import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import RequireAuth from './RequireAuth';
import { useAuth } from '../lib/auth';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));

const mockAuth = useAuth as jest.Mock;
const push = router.push as jest.Mock;

const renderGate = () =>
  render(
    <RequireAuth message="Đăng nhập để xem lịch đặt của bạn.">
      <Text>Nội dung riêng tư</Text>
    </RequireAuth>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('RequireAuth', () => {
  it('chờ đọc xong phiên đã lưu trước khi kết luận là chưa đăng nhập', async () => {
    mockAuth.mockReturnValue({ user: null, isLoading: true });
    await renderGate();

    expect(screen.getByLabelText('Đang tải')).toBeTruthy();
    expect(screen.queryByText('Cần đăng nhập')).toBeNull();
  });

  it('mời đăng nhập tại chỗ kèm lý do khi chưa có phiên', async () => {
    mockAuth.mockReturnValue({ user: null, isLoading: false });
    await renderGate();

    expect(screen.getByText('Cần đăng nhập')).toBeTruthy();
    expect(screen.getByText('Đăng nhập để xem lịch đặt của bạn.')).toBeTruthy();
    expect(screen.queryByText('Nội dung riêng tư')).toBeNull();
  });

  it('mở màn đăng nhập và màn đăng ký từ lời mời', async () => {
    mockAuth.mockReturnValue({ user: null, isLoading: false });
    await renderGate();

    fireEvent.press(screen.getByText('Đăng nhập'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/(auth)/login'));

    fireEvent.press(screen.getByText('Tạo tài khoản'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/(auth)/register'));
  });

  it('cho qua khi đã đăng nhập', async () => {
    mockAuth.mockReturnValue({ user: { _id: 'u1' }, isLoading: false });
    await renderGate();

    expect(screen.getByText('Nội dung riêng tư')).toBeTruthy();
  });
});
