import { describe, expect, it } from 'vitest';
import {
  conversationTitle, isGroupAdmin, isSeenByOthers, previewOf, startsCluster, unreadOf,
} from './chat';
import type { ChatMessage, Conversation, ConversationParticipant } from '@/types';

const ME = 'me';
const OTHER = 'other';

const participant = (
  id: string,
  overrides: Partial<ConversationParticipant> = {}
): ConversationParticipant => ({
  user: { _id: id, username: id, fullName: `Người ${id}`, avatar: '', roles: ['user'] },
  role: 'member',
  lastReadAt: null,
  unreadCount: 0,
  ...overrides,
});

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  _id: 'c1',
  type: 'direct',
  participants: [participant(ME), participant(OTHER)],
  name: '',
  avatar: '',
  context: { type: 'direct' },
  lastMessage: null,
  createdAt: '2026-08-15T10:00:00.000Z',
  updatedAt: '2026-08-15T10:00:00.000Z',
  ...overrides,
});

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  _id: 'm1',
  conversation: 'c1',
  sender: { _id: ME, username: ME, fullName: 'Người me', avatar: '', roles: ['user'] },
  kind: 'text',
  body: 'Xin chào',
  createdAt: '2026-08-15T10:00:00.000Z',
  ...overrides,
});

describe('conversationTitle', () => {
  it('hội thoại tay đôi mang tên người kia, không phải tên mình', () => {
    expect(conversationTitle(conversation(), ME)).toBe('Người other');
  });

  it('nhóm mang tên nhóm', () => {
    expect(conversationTitle(conversation({ type: 'group', name: 'Đội Sao Vàng' }), ME))
      .toBe('Đội Sao Vàng');
  });

  it('người kia đã rời đi thì vẫn ra một cái tên đọc được', () => {
    expect(conversationTitle(conversation({ participants: [participant(ME)] }), ME)).toBe('Người dùng');
  });
});

describe('unreadOf', () => {
  it('đếm phần chưa đọc của chính mình, không phải của người kia', () => {
    const c = conversation({
      participants: [participant(ME, { unreadCount: 3 }), participant(OTHER, { unreadCount: 9 })],
    });

    expect(unreadOf(c, ME)).toBe(3);
  });
});

describe('isGroupAdmin', () => {
  it('quản trị nhóm được sửa nhóm', () => {
    const c = conversation({ type: 'group', participants: [participant(ME, { role: 'admin' })] });

    expect(isGroupAdmin(c, ME)).toBe(true);
  });

  it('thành viên thường thì không', () => {
    const c = conversation({ type: 'group' });

    expect(isGroupAdmin(c, ME)).toBe(false);
  });

  it('hội thoại tay đôi không có khái niệm quản trị', () => {
    expect(isGroupAdmin(conversation({ participants: [participant(ME, { role: 'admin' })] }), ME))
      .toBe(false);
  });
});

describe('isSeenByOthers', () => {
  it('người kia đọc sau lúc gửi thì tin đã được xem', () => {
    const c = conversation({
      participants: [participant(ME), participant(OTHER, { lastReadAt: '2026-08-15T10:00:05.000Z' })],
    });

    expect(isSeenByOthers(c, message(), ME)).toBe(true);
  });

  it('người kia chỉ mới đọc tới trước đó thì chưa', () => {
    const c = conversation({
      participants: [participant(ME), participant(OTHER, { lastReadAt: '2026-08-15T09:59:00.000Z' })],
    });

    expect(isSeenByOthers(c, message(), ME)).toBe(false);
  });

  it('mốc đọc của chính mình không làm tin của mình thành "đã xem"', () => {
    const c = conversation({
      participants: [participant(ME, { lastReadAt: '2026-08-15T11:00:00.000Z' }), participant(OTHER)],
    });

    expect(isSeenByOthers(c, message(), ME)).toBe(false);
  });
});

describe('previewOf', () => {
  it('tin cuối của mình thì mở đầu bằng "Bạn:"', () => {
    const c = conversation({ lastMessage: { body: 'Mai 18h nhé', sender: ME, sentAt: '' } });

    expect(previewOf(c, ME)).toBe('Bạn: Mai 18h nhé');
  });

  it('hội thoại chưa ai nói gì thì nói rõ là chưa có', () => {
    expect(previewOf(conversation(), ME)).toBe('Chưa có tin nhắn nào');
  });
});

describe('startsCluster', () => {
  it('tin đầu tiên luôn mở một cụm', () => {
    expect(startsCluster(message())).toBe(true);
  });

  it('đổi người gửi thì cắt cụm', () => {
    const previous = message({
      sender: { _id: OTHER, username: OTHER, fullName: 'Người other', avatar: '', roles: ['user'] },
    });

    expect(startsCluster(message(), previous)).toBe(true);
  });

  it('cùng người và cách nhau vài giây thì gộp chung một cụm', () => {
    const previous = message({ createdAt: '2026-08-15T09:59:30.000Z' });

    expect(startsCluster(message(), previous)).toBe(false);
  });

  it('cùng người nhưng cách nhau hàng giờ thì là một mạch khác', () => {
    const previous = message({ createdAt: '2026-08-15T08:00:00.000Z' });

    expect(startsCluster(message(), previous)).toBe(true);
  });
});
