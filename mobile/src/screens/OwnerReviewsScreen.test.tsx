import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { OwnerReview } from '@fcp/shared';
import OwnerReviewsScreen from './OwnerReviewsScreen';
import { renderWithQuery } from '../testing/renderWithQuery';
import { useAuth } from '../lib/auth';
import { ownerService } from '../services/owner.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/owner.service', () => ({
  ownerService: { reviews: jest.fn(), replyToReview: jest.fn() },
}));

const mockAuth = useAuth as jest.Mock;
const mockReviews = ownerService.reviews as jest.Mock;
const mockReply = ownerService.replyToReview as jest.Mock;

const review = (overrides: Partial<OwnerReview> = {}) =>
  ({
    _id: 'r1',
    rating: 4,
    comment: 'Mặt cỏ tốt, đèn hơi tối',
    createdAt: '2026-08-01T00:00:00.000Z',
    field: { _id: 'f1', name: 'Sân Probe' },
    user: { fullName: 'Nguyễn Văn A' },
    ...overrides,
  }) as OwnerReview;

const listReturns = (reviews: OwnerReview[], unanswered = reviews.length) =>
  mockReviews.mockResolvedValue({ reviews, unanswered });

const submitButton = () => screen.getByRole('button', { name: 'Gửi phản hồi' });
const isEnabled = (button: ReturnType<typeof submitButton>) =>
  button.props.accessibilityState?.disabled === false;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { _id: 'u1', roles: ['field_owner'] }, isLoading: false });
  mockReply.mockResolvedValue({ review: {} });
  listReturns([review()]);
});

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('OwnerReviewsScreen', () => {
  it('hiện tên khách, sân và nội dung đánh giá', async () => {
    await renderWithQuery(<OwnerReviewsScreen />);

    expect(await screen.findByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.getByText(/Sân Probe/)).toBeTruthy();
    expect(screen.getByText('Mặt cỏ tốt, đèn hơi tối')).toBeTruthy();
  });

  it('số sao đọc được bằng trình đọc màn hình', async () => {
    await renderWithQuery(<OwnerReviewsScreen />);

    expect(await screen.findByLabelText('4 trên 5 sao')).toBeTruthy();
  });

  it('gửi phản hồi gọi đúng service kèm nội dung đã cắt khoảng trắng', async () => {
    await renderWithQuery(<OwnerReviewsScreen />);

    fireEvent.press(await screen.findByLabelText('Phản hồi đánh giá của Nguyễn Văn A'));

    // React 19 dựng lại cây bất đồng bộ: `get*` ngay sau `fireEvent` đọc trúng cây cũ,
    // và bấm một nút còn đang khoá thì không có gì xảy ra cả.
    fireEvent.changeText(await screen.findByLabelText('Nội dung'), '  Cảm ơn bạn  ');
    await waitFor(() => expect(isEnabled(submitButton())).toBe(true));
    fireEvent.press(submitButton());

    await waitFor(() => expect(mockReply).toHaveBeenCalledWith('r1', 'Cảm ơn bạn'));
  });

  it('đánh giá đã trả lời thì hiện phản hồi thay vì nút', async () => {
    listReturns([
      review({ ownerReply: { comment: 'Sân đã thay đèn', repliedAt: '2026-08-02T00:00:00.000Z' } }),
    ]);
    await renderWithQuery(<OwnerReviewsScreen />);

    expect(await screen.findByText('Sân đã thay đèn')).toBeTruthy();
    expect(screen.queryByLabelText('Phản hồi đánh giá của Nguyễn Văn A')).toBeNull();
  });

  it('lọc chưa phản hồi thì xin đúng nhóm đó', async () => {
    await renderWithQuery(<OwnerReviewsScreen />);

    fireEvent.press(await screen.findByLabelText('Chưa phản hồi (1)'));

    await waitFor(() =>
      expect(mockReviews).toHaveBeenCalledWith({ unanswered: true, limit: 50 })
    );
  });

  it('chưa có đánh giá nào thì nói rõ vì sao', async () => {
    listReturns([], 0);
    await renderWithQuery(<OwnerReviewsScreen />);

    expect(await screen.findByText('Chưa có đánh giá nào')).toBeTruthy();
  });

  it('tài khoản thường không vào được', async () => {
    mockAuth.mockReturnValue({ user: { _id: 'u1', roles: ['user'] }, isLoading: false });
    await renderWithQuery(<OwnerReviewsScreen />);

    expect(screen.getByText('Tài khoản chưa phải chủ sân')).toBeTruthy();
    expect(mockReviews).not.toHaveBeenCalled();
  });
});
