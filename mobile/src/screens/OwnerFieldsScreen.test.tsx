import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Field } from '@fcp/shared';
import OwnerFieldsScreen from './OwnerFieldsScreen';
import { renderWithQuery } from '../testing/renderWithQuery';
import { useAuth } from '../lib/auth';
import { ownerService } from '../services/owner.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/owner.service', () => ({
  ownerService: { myFields: jest.fn(), setFieldStatus: jest.fn() },
}));

const mockAuth = useAuth as jest.Mock;
const mockMyFields = ownerService.myFields as jest.Mock;
const mockSetStatus = ownerService.setFieldStatus as jest.Mock;

const field = (overrides: Partial<Field> = {}) =>
  ({
    _id: 'f1',
    name: 'Sân Probe',
    status: 'active',
    isVerified: true,
    location: { address: '12 Nguyễn Trãi' },
    subFields: [{ _id: 's1' }],
    totalBookings: 4,
    ...overrides,
  }) as Field;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { _id: 'u1', roles: ['field_owner'] }, isLoading: false });
  mockSetStatus.mockResolvedValue({ field: {} });
  mockMyFields.mockResolvedValue({ fields: [field()] });
});

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('OwnerFieldsScreen', () => {
  it('sân đang nhận đặt thì công tắc bật', async () => {
    await renderWithQuery(<OwnerFieldsScreen />);

    expect((await screen.findByLabelText('Nhận đặt sân Sân Probe')).props.value).toBe(true);
  });

  it('tắt nhận đặt gửi trạng thái inactive', async () => {
    await renderWithQuery(<OwnerFieldsScreen />);

    fireEvent(await screen.findByLabelText('Nhận đặt sân Sân Probe'), 'valueChange', false);

    await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith('f1', 'inactive'));
  });

  it('sân chưa được xác thực thì khoá công tắc và nói rõ vì sao', async () => {
    mockMyFields.mockResolvedValue({
      fields: [field({ status: 'pending_approval', isVerified: false })],
    });
    await renderWithQuery(<OwnerFieldsScreen />);

    const toggle = await screen.findByLabelText('Nhận đặt sân Sân Probe');
    expect(toggle.props.disabled).toBe(true);
    expect(screen.getByText(/phải được ban quản trị xác thực/)).toBeTruthy();
    expect(screen.getByText('Chờ duyệt')).toBeTruthy();
  });

  it('chưa có sân nào thì chỉ đường sang web để tạo', async () => {
    mockMyFields.mockResolvedValue({ fields: [] });
    await renderWithQuery(<OwnerFieldsScreen />);

    expect(await screen.findByText('Bạn chưa có sân nào')).toBeTruthy();
  });

  // Lỗi mạng thô ("Network request failed") vô nghĩa với người dùng nên `messageOf`
  // thay bằng câu chỉ rõ phải làm gì — test khoá đúng câu đó, không phải message gốc.
  it('lỗi mạng hiện thông báo kèm nút thử lại', async () => {
    mockMyFields.mockRejectedValue(new Error('Network request failed'));
    await renderWithQuery(<OwnerFieldsScreen />);

    expect(await screen.findByText(/Không kết nối được máy chủ/)).toBeTruthy();
    expect(screen.getByText('Thử lại')).toBeTruthy();
  });

  it('tài khoản thường không vào được', async () => {
    mockAuth.mockReturnValue({ user: { _id: 'u1', roles: ['user'] }, isLoading: false });
    await renderWithQuery(<OwnerFieldsScreen />);

    expect(screen.getByText('Tài khoản chưa phải chủ sân')).toBeTruthy();
    expect(mockMyFields).not.toHaveBeenCalled();
  });
});
