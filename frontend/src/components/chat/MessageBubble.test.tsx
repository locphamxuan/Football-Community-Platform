import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from './MessageBubble';
import type { ChatMessage } from '@/types';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  _id: 'm1',
  conversation: 'c1',
  sender: { _id: 'u1', username: 'nam', fullName: 'Nguyễn Văn Nam', avatar: '', roles: ['user'] },
  kind: 'text',
  body: 'Mai 18h nhé',
  createdAt: '2026-08-15T10:00:00.000Z',
  ...overrides,
});

const renderBubble = (props: Partial<React.ComponentProps<typeof MessageBubble>> = {}) =>
  render(
    <ul>
      <MessageBubble
        message={message()}
        isMine={false}
        startsCluster
        showSender={false}
        {...props}
      />
    </ul>
  );

describe('MessageBubble', () => {
  it('hiện nội dung tin nhắn', () => {
    renderBubble();

    expect(screen.getByText('Mai 18h nhé')).toBeInTheDocument();
  });

  it('trong nhóm thì nói rõ ai vừa nói, ở đầu mỗi cụm', () => {
    renderBubble({ showSender: true });

    expect(screen.getByText('Nguyễn Văn Nam')).toBeInTheDocument();
  });

  it('tin giữa cụm không lặp lại tên người gửi', () => {
    renderBubble({ showSender: true, startsCluster: false });

    expect(screen.queryByText('Nguyễn Văn Nam')).not.toBeInTheDocument();
  });

  it('tin của mình không hiện tên mình', () => {
    renderBubble({ isMine: true, showSender: true });

    expect(screen.queryByText('Nguyễn Văn Nam')).not.toBeInTheDocument();
  });

  it('tin hệ thống không phải lời của ai — không avatar, không tên người gửi', () => {
    renderBubble({
      message: message({ kind: 'system', body: 'Nam đã thêm Lộc vào nhóm' }),
      showSender: true,
    });

    expect(screen.getByText('Nam đã thêm Lộc vào nhóm')).toBeInTheDocument();
    expect(screen.queryByText('Nguyễn Văn Nam')).not.toBeInTheDocument();
  });

  it('"Đã xem" chỉ hiện khi được truyền vào', () => {
    renderBubble({ isMine: true, seenLabel: 'Đã xem' });

    expect(screen.getByText(/Đã xem/)).toBeInTheDocument();
  });
});
