import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationPreferences from './NotificationPreferences';
import userService from '@/services/user.service';
import type { User } from '@/types';

vi.mock('@/services/user.service', () => ({
  default: { getMe: vi.fn(), updateNotificationPrefs: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedGetMe = vi.mocked(userService.getMe);
const mockedUpdate = vi.mocked(userService.updateNotificationPrefs);

const userWith = (notifications: User['notifications']) =>
  ({ _id: 'u1', fullName: 'Probe', notifications } as unknown as User);

const respondWith = (user: User) => {
  const response = { data: { success: true, message: '', data: { user } } };
  mockedGetMe.mockResolvedValue(response as Awaited<ReturnType<typeof userService.getMe>>);
  mockedUpdate.mockResolvedValue(
    response as Awaited<ReturnType<typeof userService.updateNotificationPrefs>>
  );
};

const renderPrefs = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationPreferences />
    </QueryClientProvider>
  );
};

/** Công tắc là `<span role="switch">` của Base UI, được đặt tên qua `<Label htmlFor>`. */
const switchFor = (name: string) => screen.findByRole('switch', { name });

beforeEach(() => {
  respondWith(userWith({ push: true, mutedTypes: [] }));
});

describe('NotificationPreferences', () => {
  it('không tắt loại nào thì mọi công tắc đều bật', async () => {
    renderPrefs();

    expect(await switchFor('Hoá đơn mới')).toBeChecked();
    expect(await switchFor('Lịch đặt mới')).toBeChecked();
  });

  it('loại nằm trong mutedTypes hiện ở trạng thái tắt', async () => {
    respondWith(userWith({ push: true, mutedTypes: ['invoice_issued'] }));
    renderPrefs();

    expect(await switchFor('Hoá đơn mới')).not.toBeChecked();
    expect(await switchFor('Lịch đặt mới')).toBeChecked();
  });

  it('tắt một loại gửi lên cả danh sách chứ không phải phần thêm', async () => {
    respondWith(userWith({ push: true, mutedTypes: ['booking_created'] }));
    renderPrefs();

    await userEvent.click(await switchFor('Hoá đơn mới'));

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith({
        mutedTypes: ['booking_created', 'invoice_issued'],
      })
    );
  });

  it('bật lại một loại thì gỡ nó khỏi danh sách, giữ nguyên loại khác', async () => {
    respondWith(userWith({ push: true, mutedTypes: ['booking_created', 'invoice_issued'] }));
    renderPrefs();

    await userEvent.click(await switchFor('Hoá đơn mới'));

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith({ mutedTypes: ['booking_created'] })
    );
  });

  it('công tắc đẩy gửi riêng, không kèm danh sách loại', async () => {
    renderPrefs();

    await userEvent.click(await switchFor('Gửi thông báo tới điện thoại'));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith({ push: false }));
  });
});
