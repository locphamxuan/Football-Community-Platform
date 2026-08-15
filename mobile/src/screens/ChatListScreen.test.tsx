import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { Conversation, ConversationParticipant } from '@fcp/shared';
import ChatListScreen from './ChatListScreen';
import { renderWithQuery } from '../testing/renderWithQuery';
import { useAuth } from '../lib/auth';
import { chatService } from '../services/chat.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/chat.service', () => ({ chatService: { conversations: jest.fn() } }));
// Socket thật sẽ mở một kết nối WebSocket ngay khi màn hình dựng lên.
jest.mock('../lib/chatSocket', () => ({
  chatKeys: {
    conversations: ['chat', 'conversations'],
    conversation: (id: string) => ['chat', 'conversation', id],
    messages: (id: string) => ['chat', 'messages', id],
    unread: ['chat', 'unread'],
  },
  useChatRealtime: () => ({ typingUsers: [], notifyTyping: jest.fn() }),
}));

const mockAuth = useAuth as jest.Mock;
const mockConversations = chatService.conversations as jest.Mock;
const mockPush = router.push as jest.Mock;

const ME = 'me';

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
  participants: [participant(ME), participant('chu-san')],
  name: '',
  avatar: '',
  context: { type: 'direct' },
  lastMessage: { body: 'Sân còn trống 18h', sender: 'chu-san', sentAt: '2026-08-01T10:00:00.000Z' },
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  ...overrides,
});

const signedInAs = (...roles: string[]) =>
  mockAuth.mockReturnValue({ user: { id: ME, roles }, isLoading: false });

beforeEach(() => {
  jest.clearAllMocks();
  signedInAs('user');
  mockConversations.mockResolvedValue({ conversations: [conversation()], unreadCount: 0 });
});

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('ChatListScreen', () => {
  it('mỗi dòng hiện tên người kia và tin nhắn cuối', async () => {
    await renderWithQuery(<ChatListScreen />);

    expect(await screen.findByText('Người chu-san')).toBeTruthy();
    expect(screen.getByText('Sân còn trống 18h')).toBeTruthy();
  });

  it('tin cuối của mình thì xem trước ghi rõ là của mình', async () => {
    mockConversations.mockResolvedValue({
      conversations: [
        conversation({
          lastMessage: { body: 'Ok anh', sender: ME, sentAt: '2026-08-01T10:00:00.000Z' },
        }),
      ],
      unreadCount: 0,
    });
    await renderWithQuery(<ChatListScreen />);

    expect(await screen.findByText('Bạn: Ok anh')).toBeTruthy();
  });

  // Số chưa đọc phải đọc được thành lời, không chỉ là một chấm màu.
  it('số tin chưa đọc hiện ra và đọc được bằng trình đọc màn hình', async () => {
    mockConversations.mockResolvedValue({
      conversations: [
        conversation({ participants: [participant(ME, { unreadCount: 4 }), participant('chu-san')] }),
      ],
      unreadCount: 4,
    });
    await renderWithQuery(<ChatListScreen />);

    expect(await screen.findByText('4')).toBeTruthy();
    expect(screen.getByLabelText('Người chu-san, 4 tin chưa đọc')).toBeTruthy();
  });

  it('nhóm hiện tên nhóm chứ không phải tên thành viên', async () => {
    mockConversations.mockResolvedValue({
      conversations: [conversation({ type: 'group', name: 'Đội Sao Vàng' })],
      unreadCount: 0,
    });
    await renderWithQuery(<ChatListScreen />);

    expect(await screen.findByText('Đội Sao Vàng')).toBeTruthy();
  });

  it('chạm vào một dòng thì mở đúng cuộc trò chuyện', async () => {
    await renderWithQuery(<ChatListScreen />);

    fireEvent.press(await screen.findByLabelText('Người chu-san'));

    expect(mockPush).toHaveBeenCalledWith('/chat/c1');
  });

  it('nhắn tin mới mở màn chọn một người', async () => {
    await renderWithQuery(<ChatListScreen />);

    fireEvent.press(await screen.findByText('Nhắn tin mới'));

    expect(mockPush).toHaveBeenCalledWith('/chat/new?mode=direct');
  });

  it('tạo nhóm mở cùng màn ấy ở chế độ nhiều người', async () => {
    await renderWithQuery(<ChatListScreen />);

    fireEvent.press(await screen.findByText('Tạo nhóm'));

    expect(mockPush).toHaveBeenCalledWith('/chat/new?mode=group');
  });

  it('chưa có cuộc nào thì gợi ý bắt đầu từ đâu', async () => {
    mockConversations.mockResolvedValue({ conversations: [], unreadCount: 0 });
    await renderWithQuery(<ChatListScreen />);

    expect(await screen.findByText('Chưa có cuộc trò chuyện nào')).toBeTruthy();
  });

  // Backend chặn admin ở cả REST lẫn WebSocket; màn hình phải nói lý do thay vì để họ
  // nhìn một lỗi mạng.
  it('quản trị viên bị chặn ngay ở cửa, không gọi API', async () => {
    signedInAs('admin');
    await renderWithQuery(<ChatListScreen />);

    expect(await screen.findByText('Tài khoản quản trị không dùng chat')).toBeTruthy();
    expect(mockConversations).not.toHaveBeenCalled();
  });

  it('chưa đăng nhập thì mời đăng nhập', async () => {
    mockAuth.mockReturnValue({ user: null, isLoading: false });
    await renderWithQuery(<ChatListScreen />);

    expect(await screen.findByText('Cần đăng nhập')).toBeTruthy();
    expect(mockConversations).not.toHaveBeenCalled();
  });
});
