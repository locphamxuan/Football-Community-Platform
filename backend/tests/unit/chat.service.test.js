jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/notification.service');
jest.mock('../../src/socket/emitter', () => ({
  emitToUsers: jest.fn(),
  isOnline: jest.fn().mockResolvedValue(false),
}));
jest.mock('../../src/models/Conversation', () => ({
  // `buildKey` là luật chống trùng, không phải phụ thuộc ngoài — chép lại trong test là
  // tạo bản sao thứ hai của đúng cái luật đang cần kiểm.
  buildKey: jest.requireActual('../../src/models/Conversation').buildKey,
  buildGroupKey: jest.requireActual('../../src/models/Conversation').buildGroupKey,
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));
jest.mock('../../src/models/Message', () => ({
  create: jest.fn(),
  find: jest.fn(),
  deleteMany: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock('../../src/models/User', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../../src/models/Field', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/Booking', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/MatchRequest', () => ({ findById: jest.fn() }));

const Conversation = require('../../src/models/Conversation');
const Message = require('../../src/models/Message');
const User = require('../../src/models/User');
const Field = require('../../src/models/Field');
const Booking = require('../../src/models/Booking');
const MatchRequest = require('../../src/models/MatchRequest');
const { notify } = require('../../src/services/notification.service');
const { emitToUsers, isOnline } = require('../../src/socket/emitter');
const { cache, CacheKeys, resetCache } = require('../helpers/fakeRedis');
const chatService = require('../../src/services/chat');
const {
  ConversationContext, ConversationType, ParticipantRole, MessageKind,
} = require('../../src/constants/chat');
const { NotificationType } = require('../../src/constants/notifications');
const { ServerEvent } = require('../../src/socket/events');
const env = require('../../src/config/env');

const USER_ID = '000000000000000000000001';
const OWNER_ID = '000000000000000000000002';
const STRANGER_ID = '000000000000000000000003';
const CONVERSATION_ID = '000000000000000000000010';
const BOOKING_ID = '000000000000000000000020';
const FIELD_ID = '000000000000000000000030';
const MATCH_ID = '000000000000000000000040';

/** Doc mongoose giả: `populate` trả về chính nó, đủ cho service đi tiếp. */
const doc = (value) => ({ ...value, populate: jest.fn().mockResolvedValue(value) });

/**
 * Query mongoose giả: `await` được như một promise, mà vẫn `.populate()` được.
 * Service dùng cả hai kiểu trên cùng `findById` — chỉ mock một kiểu thì nửa kia ném TypeError.
 */
const queryOf = (value) => Object.assign(Promise.resolve(value), {
  populate: jest.fn().mockResolvedValue(value),
});

const conversationOf = (...userIds) => ({
  _id: CONVERSATION_ID,
  type: ConversationType.DIRECT,
  participants: userIds.map((user) => ({ user, unreadCount: 0, lastReadAt: null })),
});

/** Nhóm: mỗi phần tử là cặp [id, vai trò trong nhóm]. */
const groupOf = (...entries) => ({
  _id: CONVERSATION_ID,
  type: ConversationType.GROUP,
  name: 'Đội Sao Vàng',
  participants: entries.map(([user, role]) => ({ user, role, unreadCount: 0, lastReadAt: null })),
});

const mockRecipient = (user) => User.findById.mockReturnValue({ select: () => Promise.resolve(user) });

const mockChattableUsers = (users) =>
  User.find.mockReturnValue({ limit: () => Promise.resolve(users), select: () => Promise.resolve(users) });

beforeEach(() => {
  resetCache();
  mockRecipient({ _id: OWNER_ID, status: 'active', roles: ['user'], fullName: 'Chủ sân' });
  mockChattableUsers([{ _id: OWNER_ID, status: 'active', roles: ['user'], fullName: 'Chủ sân' }]);
  Conversation.findOne.mockResolvedValue(null);
  Conversation.create.mockImplementation(async (data) => doc({ _id: CONVERSATION_ID, ...data }));
  Conversation.findById.mockReturnValue(queryOf(conversationOf(USER_ID, OWNER_ID)));
  Conversation.updateOne.mockResolvedValue({ modifiedCount: 1 });
  Conversation.deleteOne.mockResolvedValue({ deletedCount: 1 });
  Conversation.aggregate.mockResolvedValue([]);
  Message.create.mockImplementation(async (data) => doc({
    _id: '000000000000000000000099',
    createdAt: new Date('2026-08-14T10:00:00.000Z'),
    ...data,
    sender: { _id: data.sender, fullName: 'Người gửi' },
  }));
  Message.deleteMany.mockResolvedValue({ deletedCount: 3 });
  isOnline.mockResolvedValue(false);
});

describe('openConversation', () => {
  it('mở hội thoại nhắn thẳng giữa hai tài khoản đang hoạt động', async () => {
    await chatService.openConversation(USER_ID, { recipientId: OWNER_ID });

    expect(Conversation.create).toHaveBeenCalledWith(expect.objectContaining({
      participants: [{ user: USER_ID }, { user: OWNER_ID }],
      context: { type: ConversationContext.DIRECT, ref: undefined },
    }));
  });

  it('bấm "nhắn tin" lần thứ hai quay về đúng hội thoại cũ', async () => {
    const existing = doc(conversationOf(USER_ID, OWNER_ID));
    Conversation.findOne.mockResolvedValue(existing);

    await chatService.openConversation(USER_ID, { recipientId: OWNER_ID });

    expect(Conversation.create).not.toHaveBeenCalled();
    expect(existing.populate).toHaveBeenCalled();
  });

  it('khoá không phụ thuộc ai bấm trước — hai chiều cho ra cùng một hội thoại', () => {
    expect(Conversation.buildKey(USER_ID, OWNER_ID)).toBe(Conversation.buildKey(OWNER_ID, USER_ID));
  });

  it('khoá tách theo ngữ cảnh — bàn về trận này không lẫn vào trận khác', () => {
    const a = Conversation.buildKey(USER_ID, OWNER_ID, ConversationContext.MATCH_REQUEST, MATCH_ID);
    const b = Conversation.buildKey(USER_ID, OWNER_ID, ConversationContext.MATCH_REQUEST, BOOKING_ID);

    expect(a).not.toBe(b);
  });

  it('hai người bấm cùng lúc: đụng chỉ số unique thì lấy lại cái vừa được tạo', async () => {
    const winner = doc(conversationOf(USER_ID, OWNER_ID));
    Conversation.create.mockRejectedValue({ code: 11000 });
    Conversation.findOne
      .mockResolvedValueOnce(null)
      .mockReturnValueOnce({ populate: () => Promise.resolve(winner) });

    await expect(chatService.openConversation(USER_ID, { recipientId: OWNER_ID })).resolves.toBe(winner);
  });

  it('không tự nhắn cho chính mình', async () => {
    await expect(chatService.openConversation(USER_ID, { recipientId: USER_ID }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('người nhận không tồn tại trả 404', async () => {
    mockRecipient(null);

    await expect(chatService.openConversation(USER_ID, { recipientId: OWNER_ID }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('tài khoản bị khoá không nhận được tin nhắn mới', async () => {
    mockRecipient({ _id: OWNER_ID, status: 'banned' });

    await expect(chatService.openConversation(USER_ID, { recipientId: OWNER_ID }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  describe('ngữ cảnh lịch đặt', () => {
    beforeEach(() => {
      Booking.findById.mockReturnValue({
        populate: () => Promise.resolve({ _id: BOOKING_ID, user: USER_ID, field: { owner: OWNER_ID } }),
      });
    });

    it('khách và chủ sân của đúng lịch đặt đó thì mở được', async () => {
      await chatService.openConversation(USER_ID, {
        recipientId: OWNER_ID,
        contextType: ConversationContext.BOOKING,
        contextRef: BOOKING_ID,
      });

      expect(Conversation.create).toHaveBeenCalledWith(expect.objectContaining({
        context: { type: ConversationContext.BOOKING, ref: BOOKING_ID },
      }));
    });

    it('người ngoài không gắn hội thoại của mình vào lịch đặt của người khác', async () => {
      mockRecipient({ _id: STRANGER_ID, status: 'active' });

      await expect(chatService.openConversation(USER_ID, {
        recipientId: STRANGER_ID,
        contextType: ConversationContext.BOOKING,
        contextRef: BOOKING_ID,
      })).rejects.toMatchObject({ statusCode: 403 });
      expect(Conversation.create).not.toHaveBeenCalled();
    });

    it('lịch đặt không tồn tại trả 404', async () => {
      Booking.findById.mockReturnValue({ populate: () => Promise.resolve(null) });

      await expect(chatService.openConversation(USER_ID, {
        recipientId: OWNER_ID,
        contextType: ConversationContext.BOOKING,
        contextRef: BOOKING_ID,
      })).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('ngữ cảnh sân', () => {
    beforeEach(() => {
      Field.findById.mockReturnValue({ select: () => Promise.resolve({ _id: FIELD_ID, owner: OWNER_ID }) });
    });

    it('ai cũng hỏi được chủ sân trước khi đặt', async () => {
      await chatService.openConversation(USER_ID, {
        recipientId: OWNER_ID,
        contextType: ConversationContext.FIELD,
        contextRef: FIELD_ID,
      });

      expect(Conversation.create).toHaveBeenCalled();
    });

    it('nhưng người nhận phải đúng là chủ của sân đó', async () => {
      mockRecipient({ _id: STRANGER_ID, status: 'active' });

      await expect(chatService.openConversation(USER_ID, {
        recipientId: STRANGER_ID,
        contextType: ConversationContext.FIELD,
        contextRef: FIELD_ID,
      })).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('ngữ cảnh lời mời thi đấu', () => {
    beforeEach(() => {
      MatchRequest.findById.mockReturnValue({
        populate: () => ({
          populate: () => Promise.resolve({
            _id: MATCH_ID,
            requesterTeam: { manager: USER_ID },
            opponentTeam: { manager: OWNER_ID },
          }),
        }),
      });
    });

    it('quản lý hai đội chốt trận với nhau', async () => {
      await chatService.openConversation(USER_ID, {
        recipientId: OWNER_ID,
        contextType: ConversationContext.MATCH_REQUEST,
        contextRef: MATCH_ID,
      });

      expect(Conversation.create).toHaveBeenCalled();
    });

    it('người không quản lý đội nào trong trận thì không chen vào được', async () => {
      mockRecipient({ _id: STRANGER_ID, status: 'active' });

      await expect(chatService.openConversation(USER_ID, {
        recipientId: STRANGER_ID,
        contextType: ConversationContext.MATCH_REQUEST,
        contextRef: MATCH_ID,
      })).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});

describe('sendMessage', () => {
  it('lưu tin nhắn rồi mới đẩy realtime cho cả hai bên', async () => {
    await chatService.sendMessage(USER_ID, CONVERSATION_ID, 'Mai 18h nhé');

    expect(Message.create).toHaveBeenCalledWith({
      conversation: CONVERSATION_ID,
      sender: USER_ID,
      body: 'Mai 18h nhé',
    });
    expect(emitToUsers).toHaveBeenCalledWith(
      [USER_ID, OWNER_ID],
      ServerEvent.NEW_MESSAGE,
      expect.objectContaining({ conversationId: CONVERSATION_ID })
    );
  });

  it('cộng số chưa đọc cho mọi người trừ người gửi, và cập nhật bản xem trước', async () => {
    await chatService.sendMessage(USER_ID, CONVERSATION_ID, 'Mai 18h nhé');

    expect(Conversation.updateOne).toHaveBeenCalledWith(
      { _id: CONVERSATION_ID },
      expect.objectContaining({
        $inc: { 'participants.$[other].unreadCount': 1 },
        $set: { lastMessage: expect.objectContaining({ body: 'Mai 18h nhé', sender: USER_ID }) },
      }),
      // Một lệnh ghi cho cả nhóm thay vì một lệnh cho mỗi thành viên.
      expect.objectContaining({ arrayFilters: [{ 'other.user': { $ne: expect.anything() } }] })
    );
  });

  it('người nhận đang offline thì bắn thông báo đẩy', async () => {
    isOnline.mockResolvedValue(false);

    await chatService.sendMessage(USER_ID, CONVERSATION_ID, 'Mai 18h nhé');

    expect(notify).toHaveBeenCalledWith(
      OWNER_ID,
      expect.objectContaining({ type: NotificationType.CHAT_MESSAGE, link: `/chat/${CONVERSATION_ID}` }),
      USER_ID
    );
  });

  it('người nhận đang mở ứng dụng thì không kêu thêm lần nữa', async () => {
    isOnline.mockResolvedValue(true);

    await chatService.sendMessage(USER_ID, CONVERSATION_ID, 'Mai 18h nhé');

    expect(notify).not.toHaveBeenCalled();
  });

  it('người ngoài hội thoại không gửi được', async () => {
    Conversation.findById.mockResolvedValue(conversationOf(OWNER_ID, STRANGER_ID));

    await expect(chatService.sendMessage(USER_ID, CONVERSATION_ID, 'chen vào'))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(Message.create).not.toHaveBeenCalled();
  });

  it('hội thoại không tồn tại trả 404', async () => {
    Conversation.findById.mockResolvedValue(null);

    await expect(chatService.sendMessage(USER_ID, CONVERSATION_ID, 'xin chào'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('vượt trần tần suất thì chặn trước khi kịp ghi gì', async () => {
    await cache.set(CacheKeys.chatRate(USER_ID), env.CHAT_RATE_MAX);

    await expect(chatService.sendMessage(USER_ID, CONVERSATION_ID, 'spam'))
      .rejects.toMatchObject({ statusCode: 429 });
    expect(Message.create).not.toHaveBeenCalled();
    expect(emitToUsers).not.toHaveBeenCalled();
  });

  it('trần đếm theo từng tài khoản, người này spam không khoá mồm người kia', async () => {
    await cache.set(CacheKeys.chatRate(STRANGER_ID), env.CHAT_RATE_MAX);

    await expect(chatService.sendMessage(USER_ID, CONVERSATION_ID, 'bình thường')).resolves.toBeDefined();
  });
});

describe('markRead', () => {
  it('ghi mốc đã đọc, xoá số chưa đọc và báo cho người kia', async () => {
    await chatService.markRead(USER_ID, CONVERSATION_ID);

    expect(Conversation.updateOne).toHaveBeenCalledWith(
      { _id: CONVERSATION_ID, 'participants.user': USER_ID },
      { $set: { 'participants.$.lastReadAt': expect.any(Date), 'participants.$.unreadCount': 0 } }
    );
    expect(emitToUsers).toHaveBeenCalledWith([OWNER_ID], ServerEvent.READ, expect.objectContaining({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
    }));
  });

  it('người ngoài hội thoại không đánh dấu hộ được', async () => {
    Conversation.findById.mockResolvedValue(conversationOf(OWNER_ID, STRANGER_ID));

    await expect(chatService.markRead(USER_ID, CONVERSATION_ID)).rejects.toMatchObject({ statusCode: 403 });
    expect(Conversation.updateOne).not.toHaveBeenCalled();
  });
});

describe('countUnread', () => {
  it('cộng dồn số chưa đọc của mọi hội thoại', async () => {
    Conversation.aggregate.mockResolvedValue([{ _id: null, total: 7 }]);

    await expect(chatService.countUnread(USER_ID)).resolves.toBe(7);
  });

  it('chưa có hội thoại nào thì là 0, không phải undefined', async () => {
    Conversation.aggregate.mockResolvedValue([]);

    await expect(chatService.countUnread(USER_ID)).resolves.toBe(0);
  });
});

describe('notifyTyping', () => {
  it('chỉ đẩy cho người kia và không ghi gì xuống database', async () => {
    await chatService.notifyTyping(USER_ID, CONVERSATION_ID, true);

    expect(emitToUsers).toHaveBeenCalledWith([OWNER_ID], ServerEvent.TYPING, {
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      isTyping: true,
    });
    expect(Conversation.updateOne).not.toHaveBeenCalled();
    expect(Message.create).not.toHaveBeenCalled();
  });
});

describe('createGroup', () => {
  const MEMBER_IDS = [OWNER_ID, STRANGER_ID];

  beforeEach(() => {
    mockChattableUsers([
      { _id: OWNER_ID, status: 'active', roles: ['field_owner'], fullName: 'Chủ sân' },
      { _id: STRANGER_ID, status: 'active', roles: ['user'], fullName: 'Bạn bè' },
    ]);
    Conversation.findById.mockReturnValue(queryOf(groupOf(
      [USER_ID, ParticipantRole.ADMIN],
      [OWNER_ID, ParticipantRole.MEMBER],
      [STRANGER_ID, ParticipantRole.MEMBER]
    )));
  });

  it('người lập nhóm là quản trị, những người được mời là thành viên', async () => {
    await chatService.createGroup(USER_ID, { name: 'Đội Sao Vàng', memberIds: MEMBER_IDS });

    expect(Conversation.create).toHaveBeenCalledWith(expect.objectContaining({
      type: ConversationType.GROUP,
      name: 'Đội Sao Vàng',
      createdBy: USER_ID,
      participants: [
        { user: USER_ID, role: ParticipantRole.ADMIN },
        { user: OWNER_ID, role: ParticipantRole.MEMBER },
        { user: STRANGER_ID, role: ParticipantRole.MEMBER },
      ],
    }));
  });

  it('mở đầu bằng một tin hệ thống để nhóm không hiện ra trống trơn', async () => {
    await chatService.createGroup(USER_ID, { name: 'Đội Sao Vàng', memberIds: MEMBER_IDS });

    expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({
      kind: MessageKind.SYSTEM,
      sender: USER_ID,
    }));
  });

  it('báo cho mọi thành viên để nhóm hiện ra ngay, không đợi tải lại', async () => {
    await chatService.createGroup(USER_ID, { name: 'Đội Sao Vàng', memberIds: MEMBER_IDS });

    expect(emitToUsers).toHaveBeenCalledWith(
      [USER_ID, OWNER_ID, STRANGER_ID],
      ServerEvent.CONVERSATION_UPDATED,
      expect.objectContaining({ conversation: expect.anything() })
    );
  });

  it('nhóm chỉ có mình mình thì không phải nhóm', async () => {
    await expect(chatService.createGroup(USER_ID, { name: 'Một mình', memberIds: [USER_ID] }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(Conversation.create).not.toHaveBeenCalled();
  });

  it('không kéo được quản trị viên nền tảng vào nhóm', async () => {
    mockChattableUsers([{ _id: OWNER_ID, status: 'active', roles: ['user', 'admin'] }]);

    await expect(chatService.createGroup(USER_ID, { name: 'Nhóm', memberIds: [OWNER_ID] }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(Conversation.create).not.toHaveBeenCalled();
  });

  it('không kéo được tài khoản đã bị khoá vào nhóm', async () => {
    mockChattableUsers([{ _id: OWNER_ID, status: 'banned', roles: ['user'] }]);

    await expect(chatService.createGroup(USER_ID, { name: 'Nhóm', memberIds: [OWNER_ID] }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('updateGroup', () => {
  it('quản trị nhóm đổi được tên nhóm', async () => {
    Conversation.findById.mockReturnValue(queryOf(groupOf(
      [USER_ID, ParticipantRole.ADMIN],
      [OWNER_ID, ParticipantRole.MEMBER]
    )));

    await chatService.updateGroup(USER_ID, CONVERSATION_ID, { name: 'Tên mới' });

    expect(Conversation.updateOne).toHaveBeenCalledWith(
      { _id: CONVERSATION_ID },
      { $set: { name: 'Tên mới' } }
    );
  });

  it('thành viên thường thì không đổi được tên nhóm', async () => {
    Conversation.findById.mockReturnValue(queryOf(groupOf(
      [OWNER_ID, ParticipantRole.ADMIN],
      [USER_ID, ParticipantRole.MEMBER]
    )));

    await expect(chatService.updateGroup(USER_ID, CONVERSATION_ID, { name: 'Tên mới' }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(Conversation.updateOne).not.toHaveBeenCalled();
  });

  it('hội thoại tay đôi không đổi được "tên nhóm"', async () => {
    await expect(chatService.updateGroup(USER_ID, CONVERSATION_ID, { name: 'Tên mới' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('addMembers', () => {
  beforeEach(() => {
    mockChattableUsers([{ _id: STRANGER_ID, status: 'active', roles: ['user'], fullName: 'Người mới' }]);
  });

  it('quản trị nhóm thêm được người mới', async () => {
    Conversation.findById.mockReturnValue(queryOf(groupOf(
      [USER_ID, ParticipantRole.ADMIN],
      [OWNER_ID, ParticipantRole.MEMBER]
    )));

    await chatService.addMembers(USER_ID, CONVERSATION_ID, [STRANGER_ID]);

    expect(Conversation.updateOne).toHaveBeenCalledWith(
      { _id: CONVERSATION_ID },
      { $push: { participants: { $each: [{ user: STRANGER_ID, role: ParticipantRole.MEMBER }] } } }
    );
  });

  it('thành viên thường thì không — nhóm là của người lập ra nó', async () => {
    Conversation.findById.mockReturnValue(queryOf(groupOf(
      [OWNER_ID, ParticipantRole.ADMIN],
      [USER_ID, ParticipantRole.MEMBER]
    )));

    await expect(chatService.addMembers(USER_ID, CONVERSATION_ID, [STRANGER_ID]))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(Conversation.updateOne).not.toHaveBeenCalled();
  });

  it('người đã ở trong nhóm thì không thêm lần nữa', async () => {
    Conversation.findById.mockReturnValue(queryOf(groupOf(
      [USER_ID, ParticipantRole.ADMIN],
      [OWNER_ID, ParticipantRole.MEMBER]
    )));

    await expect(chatService.addMembers(USER_ID, CONVERSATION_ID, [OWNER_ID]))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('hội thoại tay đôi không biến thành nhóm bằng cách thêm người', async () => {
    await expect(chatService.addMembers(USER_ID, CONVERSATION_ID, [STRANGER_ID]))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('removeMember', () => {
  beforeEach(() => {
    Conversation.findById.mockReturnValue(queryOf(groupOf(
      [USER_ID, ParticipantRole.ADMIN],
      [OWNER_ID, ParticipantRole.MEMBER]
    )));
  });

  it('quản trị nhóm gỡ được thành viên, và người bị gỡ cũng được báo', async () => {
    await chatService.removeMember(USER_ID, CONVERSATION_ID, OWNER_ID);

    expect(Conversation.updateOne).toHaveBeenCalledWith(
      { _id: CONVERSATION_ID },
      { $pull: { participants: { user: expect.anything() } } }
    );
    expect(emitToUsers).toHaveBeenCalledWith(
      expect.arrayContaining([OWNER_ID]),
      ServerEvent.CONVERSATION_UPDATED,
      expect.anything()
    );
  });

  it('tự gỡ mình là rời nhóm — đi cửa khác', async () => {
    await expect(chatService.removeMember(USER_ID, CONVERSATION_ID, USER_ID))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('người không ở trong nhóm thì không có gì để gỡ', async () => {
    await expect(chatService.removeMember(USER_ID, CONVERSATION_ID, STRANGER_ID))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('leaveGroup', () => {
  it('quản trị cuối cùng rời đi thì người còn lại lên thay, nhóm không kẹt', async () => {
    Conversation.findById.mockReturnValue(queryOf(groupOf(
      [USER_ID, ParticipantRole.ADMIN],
      [OWNER_ID, ParticipantRole.MEMBER]
    )));

    await chatService.leaveGroup(USER_ID, CONVERSATION_ID);

    expect(Conversation.updateOne).toHaveBeenCalledWith(
      { _id: CONVERSATION_ID, 'participants.user': OWNER_ID },
      { $set: { 'participants.$.role': ParticipantRole.ADMIN } }
    );
  });

  it('người cuối cùng rời đi thì nhóm và tin nhắn biến mất cùng nhau', async () => {
    Conversation.findById.mockReturnValue(queryOf(groupOf([USER_ID, ParticipantRole.ADMIN])));

    await expect(chatService.leaveGroup(USER_ID, CONVERSATION_ID))
      .resolves.toMatchObject({ deleted: true });
    expect(Conversation.deleteOne).toHaveBeenCalledWith({ _id: CONVERSATION_ID });
    expect(Message.deleteMany).toHaveBeenCalledWith({ conversation: CONVERSATION_ID });
  });

  it('không rời được hội thoại tay đôi', async () => {
    await expect(chatService.leaveGroup(USER_ID, CONVERSATION_ID))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('sendMessage trong nhóm', () => {
  beforeEach(() => {
    Conversation.findById.mockReturnValue(queryOf(groupOf(
      [USER_ID, ParticipantRole.ADMIN],
      [OWNER_ID, ParticipantRole.MEMBER],
      [STRANGER_ID, ParticipantRole.MEMBER]
    )));
  });

  it('đẩy tới mọi thành viên, kể cả chính người gửi trên thiết bị khác', async () => {
    await chatService.sendMessage(USER_ID, CONVERSATION_ID, 'Mai 18h nhé');

    expect(emitToUsers).toHaveBeenCalledWith(
      [USER_ID, OWNER_ID, STRANGER_ID],
      ServerEvent.NEW_MESSAGE,
      expect.anything()
    );
  });

  it('mỗi thành viên đang offline nhận một thông báo mang tên nhóm', async () => {
    await chatService.sendMessage(USER_ID, CONVERSATION_ID, 'Mai 18h nhé');

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(
      OWNER_ID,
      expect.objectContaining({ title: expect.stringContaining('Đội Sao Vàng') }),
      USER_ID
    );
  });
});

describe('getMessages', () => {
  it('người ngoài hội thoại không đọc được lịch sử', async () => {
    Conversation.findById.mockResolvedValue(conversationOf(OWNER_ID, STRANGER_ID));

    await expect(chatService.getMessages(USER_ID, CONVERSATION_ID, {}))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(Message.find).not.toHaveBeenCalled();
  });
});
