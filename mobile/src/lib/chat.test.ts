import type { ChatMessage, Conversation, ConversationParticipant } from '@fcp/shared';
import {
  conversationTitle,
  isGroupAdmin,
  isSeenByOthers,
  participantsExcept,
  previewOf,
  unreadOf,
} from './chat';

const ME = 'me';
const THEM = 'them';

const participant = (
  _id: string,
  overrides: Partial<ConversationParticipant> = {}
): ConversationParticipant => ({
  user: { _id, username: `user-${_id}`, fullName: `Người ${_id}`, avatar: '', roles: ['user'] },
  role: 'member',
  lastReadAt: null,
  unreadCount: 0,
  ...overrides,
});

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  _id: 'c1',
  type: 'direct',
  participants: [participant(ME), participant(THEM)],
  name: '',
  avatar: '',
  context: { type: 'direct' },
  lastMessage: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  _id: 'm1',
  conversation: 'c1',
  sender: { _id: ME, username: 'user-me', fullName: 'Người me', avatar: '', roles: ['user'] },
  kind: 'text',
  body: 'Mai 18h nhé',
  createdAt: '2026-08-01T10:00:00.000Z',
  ...overrides,
});

describe('participantsExcept', () => {
  it('bỏ chính mình khỏi danh sách', () => {
    expect(participantsExcept(conversation(), ME).map((p) => p.user._id)).toEqual([THEM]);
  });

  it('chưa biết mình là ai thì giữ nguyên cả hai', () => {
    expect(participantsExcept(conversation(), undefined)).toHaveLength(2);
  });
});

describe('conversationTitle', () => {
  it('tay đôi lấy tên người kia, không phải tên mình', () => {
    expect(conversationTitle(conversation(), ME)).toBe('Người them');
  });

  it('nhóm lấy tên nhóm', () => {
    expect(conversationTitle(conversation({ type: 'group', name: 'Đội Sao Vàng' }), ME))
      .toBe('Đội Sao Vàng');
  });

  // Hộp thư không được có dòng trống: một hội thoại không tên vẫn phải bấm vào được.
  it('nhóm chưa có tên vẫn ra một cái tên đọc được', () => {
    expect(conversationTitle(conversation({ type: 'group', name: '' }), ME)).toBe('Nhóm chat');
  });

  it('người kia chưa có họ tên thì rơi về tên đăng nhập', () => {
    const anonymous = conversation({
      participants: [
        participant(ME),
        { ...participant(THEM), user: { ...participant(THEM).user, fullName: '' } },
      ],
    });

    expect(conversationTitle(anonymous, ME)).toBe('user-them');
  });
});

describe('unreadOf', () => {
  it('đếm theo phần của chính mình', () => {
    const withUnread = conversation({
      participants: [participant(ME, { unreadCount: 3 }), participant(THEM, { unreadCount: 9 })],
    });

    expect(unreadOf(withUnread, ME)).toBe(3);
  });

  it('không có phần của mình thì coi như đã đọc hết', () => {
    expect(unreadOf(conversation(), 'người-lạ')).toBe(0);
  });
});

describe('isGroupAdmin', () => {
  it('quản trị nhóm được sửa nhóm', () => {
    const group = conversation({
      type: 'group',
      participants: [participant(ME, { role: 'admin' }), participant(THEM)],
    });

    expect(isGroupAdmin(group, ME)).toBe(true);
    expect(isGroupAdmin(group, THEM)).toBe(false);
  });

  // Hội thoại tay đôi không có ai "quản trị" — nếu có, giao diện sẽ mọc ra nút đổi tên
  // cho một cuộc trò chuyện lấy tên từ người kia.
  it('hội thoại tay đôi không có quản trị', () => {
    const direct = conversation({ participants: [participant(ME, { role: 'admin' })] });

    expect(isGroupAdmin(direct, ME)).toBe(false);
  });
});

describe('previewOf', () => {
  it('tin cuối của mình thì gắn tiền tố "Bạn:"', () => {
    const mine = conversation({
      lastMessage: { body: 'Ok em', sender: ME, sentAt: '2026-08-01T10:00:00.000Z' },
    });

    expect(previewOf(mine, ME)).toBe('Bạn: Ok em');
  });

  it('tin của người kia thì để nguyên', () => {
    const theirs = conversation({
      lastMessage: { body: 'Ok em', sender: THEM, sentAt: '2026-08-01T10:00:00.000Z' },
    });

    expect(previewOf(theirs, ME)).toBe('Ok em');
  });

  it('chưa ai nhắn gì thì nói rõ là chưa có tin', () => {
    expect(previewOf(conversation(), ME)).toBe('Chưa có tin nhắn nào');
  });
});

describe('isSeenByOthers', () => {
  const sentAt = '2026-08-01T10:00:00.000Z';

  it('người kia đọc sau lúc gửi thì là đã xem', () => {
    const seen = conversation({
      participants: [participant(ME), participant(THEM, { lastReadAt: '2026-08-01T10:00:01.000Z' })],
    });

    expect(isSeenByOthers(seen, message({ createdAt: sentAt }), ME)).toBe(true);
  });

  it('người kia chỉ đọc tới trước lúc gửi thì chưa xem', () => {
    const stale = conversation({
      participants: [participant(ME), participant(THEM, { lastReadAt: '2026-08-01T09:59:59.000Z' })],
    });

    expect(isSeenByOthers(stale, message({ createdAt: sentAt }), ME)).toBe(false);
  });

  // Mốc đọc của chính mình luôn mới hơn tin mình vừa gửi — tính cả nó thì mọi tin đều
  // "đã xem" ngay khi gửi đi.
  it('mốc đọc của chính mình không tính là đã xem', () => {
    const onlyMine = conversation({
      participants: [
        participant(ME, { lastReadAt: '2026-08-01T11:00:00.000Z' }),
        participant(THEM),
      ],
    });

    expect(isSeenByOthers(onlyMine, message({ createdAt: sentAt }), ME)).toBe(false);
  });

  it('trong nhóm chỉ cần một người đã đọc', () => {
    const group = conversation({
      type: 'group',
      participants: [
        participant(ME),
        participant(THEM),
        participant('third', { lastReadAt: '2026-08-01T10:30:00.000Z' }),
      ],
    });

    expect(isSeenByOthers(group, message({ createdAt: sentAt }), ME)).toBe(true);
  });
});
