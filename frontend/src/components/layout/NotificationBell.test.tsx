import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationBell from './NotificationBell';
import notificationService from '@/services/notification.service';
import type { Notification } from '@/types';

vi.mock('@/services/notification.service', () => ({
  default: { getAll: vi.fn(), markAsRead: vi.fn(), markAllAsRead: vi.fn() },
}));

const mockedGetAll = vi.mocked(notificationService.getAll);

const respondWith = (notifications: Notification[], unreadCount: number) => {
  mockedGetAll.mockResolvedValue({
    data: { success: true, message: '', data: { notifications, unreadCount } },
  } as Awaited<ReturnType<typeof notificationService.getAll>>);
};

const renderBell = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  respondWith([], 0);
});

describe('NotificationBell', () => {
  it('không có thông báo chưa đọc thì không hiện huy hiệu', async () => {
    renderBell();

    expect(await screen.findByLabelText('Thông báo')).toBeInTheDocument();
  });

  it('hiện số chưa đọc trên huy hiệu và trong nhãn trợ năng', async () => {
    respondWith([], 5);
    renderBell();

    expect(await screen.findByLabelText('Thông báo, 5 chưa đọc')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('quá 99 thì rút gọn thành 99+ để không vỡ chuông', async () => {
    respondWith([], 150);
    renderBell();

    expect(await screen.findByText('99+')).toBeInTheDocument();
  });
});
