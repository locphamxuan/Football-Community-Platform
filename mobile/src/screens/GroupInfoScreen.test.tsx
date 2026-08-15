import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { Conversation, ConversationParticipant } from '@fcp/shared';
import GroupInfoScreen from './GroupInfoScreen';
import { renderWithQuery } from '../testing/renderWithQuery';
import { useAuth } from '../lib/auth';
import { chatService } from '../services/chat.service';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));
jest.mock('../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/chat.service', () => ({
  chatService: {
    conversation: jest.fn(),
    renameGroup: jest.fn(),
    addMembers: jest.fn(),
    removeMember: jest.fn(),
    leaveGroup: jest.fn(),
    searchUsers: jest.fn(),
  },
}));
jest.mock('../lib/chatSocket', () => ({
  chatKeys: {
    conversations: ['chat', 'conversations'],
    conversation: (id: string) => ['chat', 'conversation', id],
  },
}));

const mockAuth = useAuth as jest.Mock;
const mockConversation = chatService.conversation as jest.Mock;
const mockRename = chatService.renameGroup as jest.Mock;
const mockRemoveMember = chatService.removeMember as jest.Mock;
const mockLeave = chatService.leaveGroup as jest.Mock;
const mockReplace = router.replace as jest.Mock;

const ME = 'me';
const GROUP_ID = 'c1';

const participant = (
  _id: string,
  role: ConversationParticipant['role'] = 'member'
): ConversationParticipant => ({
  user: { _id, username: `user-${_id}`, fullName: `Người ${_id}`, avatar: '', roles: ['user'] },
  role,
  lastReadAt: null,
  unreadCount: 0,
});

const groupReturns = (myRole: ConversationParticipant['role']) =>
  mockConversation.mockResolvedValue({
    conversation: {
      _id: GROUP_ID,
      type: 'group',
      participants: [participant(ME, myRole), participant('ban')],
      name: 'Đội Sao Vàng',
      avatar: '',
      createdBy: ME,
      context: { type: 'direct' },
      lastMessage: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    } satisfies Conversation,
  });

const saveNameButton = () => screen.getByRole('button', { name: 'Lưu tên nhóm' });
const isEnabled = (button: ReturnType<typeof saveNameButton>) =>
  button.props.accessibilityState?.disabled === false;

/**
 * Bấm hộp xác nhận của hệ thống — `Alert` không dựng gì trong cây React để chạm vào, nên
 * phải gọi thẳng `onPress`; bọc `act` vì cái bấm ấy khởi động một mutation.
 */
const confirmAlert = async (label: string) => {
  const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1)!;
  const button = buttons.find((candidate: { text: string }) => candidate.text === label);
  await act(async () => button.onPress());
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockAuth.mockReturnValue({ user: { id: ME, roles: ['user'] }, isLoading: false });
  groupReturns('admin');
  (chatService.searchUsers as jest.Mock).mockResolvedValue({ users: [] });
  mockLeave.mockResolvedValue({ conversationId: GROUP_ID, deleted: false });
});

// RNTL 14 render bất đồng bộ (React 19 concurrent) — luôn phải await
describe('GroupInfoScreen', () => {
  it('liệt kê thành viên và đánh dấu chính mình', async () => {
    await renderWithQuery(<GroupInfoScreen conversationId={GROUP_ID} />);

    expect(await screen.findByText('2 thành viên')).toBeTruthy();
    expect(screen.getByText('Người me (bạn)')).toBeTruthy();
    expect(screen.getByText('Người ban')).toBeTruthy();
  });

  it('quản trị nhóm đổi được tên nhóm', async () => {
    mockRename.mockResolvedValue({});
    await renderWithQuery(<GroupInfoScreen conversationId={GROUP_ID} />);

    fireEvent.changeText(await screen.findByLabelText('Tên nhóm'), '  Sao Vàng FC  ');

    // React 19 dựng lại cây bất đồng bộ: bấm ngay là bấm vào nút còn đang khoá vì tên
    // chưa đổi, và không có gì xảy ra cả.
    await waitFor(() => expect(isEnabled(saveNameButton())).toBe(true));
    fireEvent.press(saveNameButton());

    await waitFor(() => expect(mockRename).toHaveBeenCalledWith(GROUP_ID, 'Sao Vàng FC'));
  });

  it('quản trị nhóm gỡ được người khác', async () => {
    mockRemoveMember.mockResolvedValue({});
    await renderWithQuery(<GroupInfoScreen conversationId={GROUP_ID} />);

    fireEvent.press(await screen.findByLabelText('Gỡ Người ban khỏi nhóm'));

    await waitFor(() => expect(mockRemoveMember).toHaveBeenCalledWith(GROUP_ID, 'ban'));
  });

  // Tự gỡ mình là "rời nhóm" — backend có luật riêng cho nó, và một nút "Gỡ" cạnh tên
  // mình chỉ khiến người dùng bấm nhầm.
  it('không có nút gỡ cho chính mình', async () => {
    await renderWithQuery(<GroupInfoScreen conversationId={GROUP_ID} />);

    await screen.findByText('Người me (bạn)');
    expect(screen.queryByLabelText('Gỡ Người me khỏi nhóm')).toBeNull();
  });

  it('thành viên thường chỉ xem, không thấy nút sửa nhóm', async () => {
    groupReturns('member');
    await renderWithQuery(<GroupInfoScreen conversationId={GROUP_ID} />);

    expect(await screen.findByText('Người ban')).toBeTruthy();
    expect(screen.queryByLabelText('Tên nhóm')).toBeNull();
    expect(screen.queryByLabelText('Gỡ Người ban khỏi nhóm')).toBeNull();
    expect(screen.queryByLabelText('Thêm thành viên')).toBeNull();
  });

  // Rời nhóm không lấy lại được, nên phải hỏi trước; và ở lại một nhóm vừa rời thì mọi
  // thao tác tiếp theo chỉ nhận 403.
  it('thành viên thường rời được nhóm sau khi xác nhận, rồi về hộp thư', async () => {
    groupReturns('member');
    await renderWithQuery(<GroupInfoScreen conversationId={GROUP_ID} />);

    fireEvent.press(await screen.findByRole('button', { name: 'Rời nhóm' }));
    expect(mockLeave).not.toHaveBeenCalled();

    await confirmAlert('Rời nhóm');

    await waitFor(() => expect(mockLeave).toHaveBeenCalledWith(GROUP_ID));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/chat');
  });
});
