import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MessagesLink from './MessagesLink';
import chatService from '@/services/chat.service';

vi.mock('@/services/chat.service', () => ({
  default: { getUnreadCount: vi.fn() },
}));

const respondWith = (unreadCount: number) =>
  vi.mocked(chatService.getUnreadCount).mockResolvedValue({
    data: { success: true, message: '', data: { unreadCount } },
  } as Awaited<ReturnType<typeof chatService.getUnreadCount>>);

const renderLink = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MessagesLink />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  respondWith(0);
});

describe('MessagesLink', () => {
  it('không có tin chưa đọc thì không hiện huy hiệu', async () => {
    renderLink();

    expect(await screen.findByLabelText('Tin nhắn')).toBeInTheDocument();
  });

  it('hiện số chưa đọc trên huy hiệu và trong nhãn trợ năng', async () => {
    respondWith(4);

    renderLink();

    expect(await screen.findByLabelText('Tin nhắn, 4 chưa đọc')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('quá 99 tin thì rút gọn để không phá vỡ thanh điều hướng', async () => {
    respondWith(180);

    renderLink();

    expect(await screen.findByText('99+')).toBeInTheDocument();
  });
});
