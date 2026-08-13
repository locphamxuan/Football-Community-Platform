import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Invoice, SubscriptionOverview } from '@fcp/shared';
import OwnerBillingScreen from './OwnerBillingScreen';
import { renderWithQuery } from '../testing/renderWithQuery';
import { useAuth } from '../lib/auth';
import { ownerService } from '../services/owner.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/owner.service', () => ({
  ownerService: {
    subscription: jest.fn(),
    invoices: jest.fn(),
    setAutoRenew: jest.fn(),
    reportPayment: jest.fn(),
  },
}));

const mockAuth = useAuth as jest.Mock;
const mockSubscription = ownerService.subscription as jest.Mock;
const mockInvoices = ownerService.invoices as jest.Mock;
const mockAutoRenew = ownerService.setAutoRenew as jest.Mock;
const mockReport = ownerService.reportPayment as jest.Mock;

const overview = (overrides: Partial<SubscriptionOverview> = {}) =>
  ({
    subscription: {
      status: 'active',
      autoRenew: true,
      currentPeriodEnd: '2026-09-01T00:00:00.000Z',
    },
    plan: { name: 'Basic', monthlyPrice: 199000, includedBookingsPerMonth: 200 },
    usage: { activeFields: 1, totalFields: 2, bookingsThisMonth: 37 },
    outstandingAmount: 0,
    ...overrides,
  }) as SubscriptionOverview;

const invoice = (overrides: Partial<Invoice> = {}) =>
  ({
    _id: 'i1',
    code: 'INV-2608',
    description: 'Gói Basic tháng 8',
    amount: 199000,
    dueDate: '2026-08-20T00:00:00.000Z',
    status: 'pending',
    paymentReference: '',
    ...overrides,
  }) as Invoice;

const submitButton = () => screen.getByRole('button', { name: 'Gửi cho ban quản trị' });
const isEnabled = (button: ReturnType<typeof submitButton>) =>
  button.props.accessibilityState?.disabled === false;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { _id: 'u1', roles: ['field_owner'] }, isLoading: false });
  mockSubscription.mockResolvedValue(overview());
  mockInvoices.mockResolvedValue({ invoices: [invoice()] });
  mockAutoRenew.mockResolvedValue({ subscription: {} });
  mockReport.mockResolvedValue({ invoice: {} });
});

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('OwnerBillingScreen', () => {
  it('hiện gói hiện tại và mức đã dùng', async () => {
    await renderWithQuery(<OwnerBillingScreen />);

    expect(await screen.findByText('Gói Basic')).toBeTruthy();
    expect(screen.getByText('37/200')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('tắt tự gia hạn gửi đúng giá trị', async () => {
    await renderWithQuery(<OwnerBillingScreen />);

    fireEvent(await screen.findByLabelText('Tự động gia hạn'), 'valueChange', false);

    await waitFor(() => expect(mockAutoRenew).toHaveBeenCalledWith(false));
  });

  it('hoá đơn quá hạn được cảnh báo ngay đầu trang', async () => {
    mockSubscription.mockResolvedValue(
      overview({
        subscription: {
          status: 'past_due',
          autoRenew: true,
          currentPeriodEnd: '2026-09-01T00:00:00.000Z',
        } as SubscriptionOverview['subscription'],
        outstandingAmount: 199000,
      })
    );
    await renderWithQuery(<OwnerBillingScreen />);

    expect(await screen.findByText(/Đang có hoá đơn quá hạn/)).toBeTruthy();
  });

  it('khai báo chuyển khoản gửi mã giao dịch của đúng hoá đơn', async () => {
    await renderWithQuery(<OwnerBillingScreen />);

    fireEvent.press(
      await screen.findByLabelText('Khai báo đã chuyển khoản cho hoá đơn INV-2608')
    );

    // React 19 dựng lại cây bất đồng bộ: `get*` ngay sau `fireEvent` đọc trúng cây cũ,
    // và bấm một nút còn đang khoá thì không có gì xảy ra cả.
    fireEvent.changeText(await screen.findByLabelText('Mã giao dịch'), 'FT24081312345');
    await waitFor(() => expect(isEnabled(submitButton())).toBe(true));
    fireEvent.press(submitButton());

    await waitFor(() => expect(mockReport).toHaveBeenCalledWith('i1', 'FT24081312345'));
  });

  it('hoá đơn đã khai báo thì chờ đối soát, không cho khai lại', async () => {
    mockInvoices.mockResolvedValue({
      invoices: [invoice({ status: 'awaiting_confirmation', paymentReference: 'FT999' })],
    });
    await renderWithQuery(<OwnerBillingScreen />);

    expect(await screen.findByText(/Đã gửi mã FT999/)).toBeTruthy();
    expect(screen.queryByLabelText('Khai báo đã chuyển khoản cho hoá đơn INV-2608')).toBeNull();
  });

  it('tài khoản thường không vào được', async () => {
    mockAuth.mockReturnValue({ user: { _id: 'u1', roles: ['user'] }, isLoading: false });
    await renderWithQuery(<OwnerBillingScreen />);

    expect(screen.getByText('Tài khoản chưa phải chủ sân')).toBeTruthy();
    expect(mockSubscription).not.toHaveBeenCalled();
  });
});
