import { screen, waitFor } from '@testing-library/react-native';
import PlansScreen from './PlansScreen';
import { renderWithQuery } from '../testing/renderWithQuery';

const plans = [
  {
    code: 'free',
    name: 'Miễn phí',
    monthlyPrice: 0,
    maxFields: 1,
    maxSubFieldsPerField: 2,
    includedBookingsPerMonth: 50,
    features: ['1 sân'],
  },
  {
    code: 'pro',
    name: 'Chuyên nghiệp',
    monthlyPrice: 799000,
    maxFields: 20,
    maxSubFieldsPerField: 20,
    includedBookingsPerMonth: -1,
    features: ['20 sân'],
  },
];

const mockFetch = (body: unknown, ok = true, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
};

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('PlansScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hiện trạng thái đang tải trước khi có dữ liệu', async () => {
    // fetch không bao giờ resolve → màn hình đứng ở trạng thái loading
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    await renderWithQuery(<PlansScreen />);

    expect(screen.getByLabelText('Đang tải bảng giá')).toBeTruthy();
  });

  it('hiện tên, giá và quyền lợi của từng gói', async () => {
    mockFetch({ success: true, message: 'ok', data: { plans } });
    await renderWithQuery(<PlansScreen />);

    await waitFor(() => expect(screen.getByText('Miễn phí')).toBeTruthy());
    expect(screen.getByText('Chuyên nghiệp')).toBeTruthy();
    expect(screen.getByText(/799\.000/)).toBeTruthy();
    expect(screen.getByText('• 20 sân')).toBeTruthy();
  });

  it('hiện "Không giới hạn" cho hạn mức -1', async () => {
    mockFetch({ success: true, message: 'ok', data: { plans } });
    await renderWithQuery(<PlansScreen />);

    await waitFor(() => expect(screen.getByText(/Không giới hạn lượt đặt/)).toBeTruthy());
  });

  it('gọi API thất bại thì hiện message của backend kèm nút thử lại', async () => {
    mockFetch({ success: false, message: 'Máy chủ đang bảo trì' }, false, 503);
    await renderWithQuery(<PlansScreen />);

    await waitFor(() => expect(screen.getByText('Máy chủ đang bảo trì')).toBeTruthy());
    expect(screen.getByText('Thử lại')).toBeTruthy();
  });
});
