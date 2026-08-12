import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationItem from './NotificationItem';
import type { Notification } from '@/types';

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  _id: 'n1',
  type: 'booking_confirmed',
  title: 'Lịch đặt đã được xác nhận',
  body: 'Sân Probe · 24/08/2026 18:00–20:00',
  link: '/bookings',
  readAt: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('NotificationItem', () => {
  it('hiển thị tiêu đề, nội dung và nhãn loại', () => {
    render(<NotificationItem notification={makeNotification()} onOpen={vi.fn()} />);

    expect(screen.getByText('Lịch đặt đã được xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Sân Probe · 24/08/2026 18:00–20:00')).toBeInTheDocument();
    expect(screen.getByText(/Lịch đặt được xác nhận/)).toBeInTheDocument();
  });

  it('thông báo chưa đọc có chấm đánh dấu', () => {
    render(<NotificationItem notification={makeNotification()} onOpen={vi.fn()} />);

    expect(screen.getByLabelText('Chưa đọc')).toBeInTheDocument();
  });

  it('thông báo đã đọc thì không còn chấm', () => {
    render(
      <NotificationItem
        notification={makeNotification({ readAt: new Date().toISOString() })}
        onOpen={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Chưa đọc')).not.toBeInTheDocument();
  });

  it('có link thì render thành liên kết tới đúng đường dẫn', () => {
    render(<NotificationItem notification={makeNotification()} onOpen={vi.fn()} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/bookings');
  });

  it('không có link thì vẫn bấm được để đánh dấu đã đọc', async () => {
    const onOpen = vi.fn();
    render(<NotificationItem notification={makeNotification({ link: '' })} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('bấm vào liên kết cũng báo đã mở — đọc và điều hướng là một thao tác', async () => {
    const onOpen = vi.fn();
    render(<NotificationItem notification={makeNotification()} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('link'));

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ _id: 'n1' }));
  });
});
