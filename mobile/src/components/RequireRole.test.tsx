import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import RequireRole from './RequireRole';
import { useAuth } from '../lib/auth';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));

const mockAuth = useAuth as jest.Mock;

const renderGate = () =>
  render(
    <RequireRole
      allow={['field_owner', 'admin']}
      authMessage="Đăng nhập bằng tài khoản chủ sân."
      deniedTitle="Tài khoản chưa phải chủ sân"
      deniedHint="Liên hệ ban quản trị để được nâng quyền."
    >
      <Text>Khu quản lý sân</Text>
    </RequireRole>
  );

const signedInAs = (...roles: string[]) =>
  mockAuth.mockReturnValue({ user: { _id: 'u1', roles }, isLoading: false });

beforeEach(() => {
  jest.clearAllMocks();
});

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('RequireRole', () => {
  it('chưa đăng nhập thì mời đăng nhập, không nói gì về quyền', async () => {
    mockAuth.mockReturnValue({ user: null, isLoading: false });
    await renderGate();

    expect(screen.getByText('Cần đăng nhập')).toBeTruthy();
    expect(screen.queryByText('Tài khoản chưa phải chủ sân')).toBeNull();
  });

  it('thiếu quyền thì nói rõ lý do thay vì để màn hình rỗng', async () => {
    signedInAs('user');
    await renderGate();

    expect(screen.getByText('Tài khoản chưa phải chủ sân')).toBeTruthy();
    expect(screen.queryByText('Khu quản lý sân')).toBeNull();
  });

  it('cho qua khi có đúng vai trò', async () => {
    signedInAs('user', 'field_owner');
    await renderGate();

    expect(screen.getByText('Khu quản lý sân')).toBeTruthy();
  });

  it('admin vào được khu của chủ sân — khớp với cổng quyền trên web', async () => {
    signedInAs('user', 'admin');
    await renderGate();

    expect(screen.getByText('Khu quản lý sân')).toBeTruthy();
  });
});
