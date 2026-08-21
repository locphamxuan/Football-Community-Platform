jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/chat.service');

const request = require('supertest');
const app = require('../../src/app');
const chatService = require('../../src/services/chat.service');
const { AppError } = require('../../src/middleware/errorHandler');
const { asUser, asAdmin, USER_ID } = require('../helpers/auth');
const {
  ConversationContext, MESSAGE_MAX_LENGTH, GROUP_NAME_MAX_LENGTH, GROUP_MAX_PARTICIPANTS,
} = require('../../src/constants/chat');

const CONVERSATION_ID = '000000000000000000000010';
const RECIPIENT_ID = '000000000000000000000002';
const MEMBER_ID = '000000000000000000000003';
const BOOKING_ID = '000000000000000000000020';

beforeEach(() => {
  chatService.getMyConversations.mockResolvedValue({ conversations: [], total: 0, page: 1, limit: 10 });
  chatService.countUnread.mockResolvedValue(0);
  chatService.getMessages.mockResolvedValue({ messages: [], total: 0, page: 1, limit: 10 });
  chatService.openConversation.mockResolvedValue({ _id: CONVERSATION_ID });
  chatService.getConversation.mockResolvedValue({ _id: CONVERSATION_ID });
  chatService.createGroup.mockResolvedValue({ _id: CONVERSATION_ID });
  chatService.updateGroup.mockResolvedValue({ _id: CONVERSATION_ID });
  chatService.addMembers.mockResolvedValue({ _id: CONVERSATION_ID });
  chatService.removeMember.mockResolvedValue({ _id: CONVERSATION_ID });
  chatService.leaveGroup.mockResolvedValue({ conversationId: CONVERSATION_ID, deleted: false });
  chatService.sendMessage.mockResolvedValue({ message: { _id: '000000000000000000000099' } });
  chatService.markRead.mockResolvedValue({ conversationId: CONVERSATION_ID, readAt: new Date() });
});

const EVERY_ROUTE = [
  ['get', '/api/v1/chat/conversations'],
  ['post', '/api/v1/chat/conversations'],
  ['get', '/api/v1/chat/unread-count'],
  ['post', '/api/v1/chat/groups'],
  ['get', `/api/v1/chat/conversations/${CONVERSATION_ID}`],
  ['patch', `/api/v1/chat/conversations/${CONVERSATION_ID}`],
  ['get', `/api/v1/chat/conversations/${CONVERSATION_ID}/messages`],
  ['post', `/api/v1/chat/conversations/${CONVERSATION_ID}/messages`],
  ['post', `/api/v1/chat/conversations/${CONVERSATION_ID}/read`],
  ['post', `/api/v1/chat/conversations/${CONVERSATION_ID}/members`],
  ['delete', `/api/v1/chat/conversations/${CONVERSATION_ID}/members/${MEMBER_ID}`],
  ['post', `/api/v1/chat/conversations/${CONVERSATION_ID}/leave`],
];

describe('toàn bộ /api/v1/chat cần đăng nhập', () => {
  it.each(EVERY_ROUTE)('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });
});

/**
 * Quản trị viên nền tảng đứng ngoài mọi cuộc trò chuyện: họ xử lý khiếu nại bằng công cụ
 * quản trị, và một kênh riêng với họ trong app là kênh không ai kiểm được.
 */
describe('quản trị viên nền tảng không dùng chat', () => {
  it.each(EVERY_ROUTE)('%s %s trả 403 với tài khoản admin', async (method, url) => {
    const res = await request(app)[method](url).set(asAdmin());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/chat/conversations', () => {
  it('trả danh sách, tổng chưa đọc và phân trang trong một lần gọi', async () => {
    chatService.getMyConversations.mockResolvedValue({
      conversations: [{ _id: CONVERSATION_ID }], total: 1, page: 1, limit: 10,
    });
    chatService.countUnread.mockResolvedValue(3);

    const res = await request(app).get('/api/v1/chat/conversations').set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data.conversations).toHaveLength(1);
    expect(res.body.data.unreadCount).toBe(3);
    expect(res.body.meta.pagination.total).toBe(1);
  });

  it('chỉ hỏi hội thoại của chính người gọi', async () => {
    await request(app).get('/api/v1/chat/conversations').set(asUser());

    expect(chatService.getMyConversations).toHaveBeenCalledWith(USER_ID, expect.any(Object));
  });

  it.each([
    ['ngữ cảnh không tồn tại', { contextType: 'zalo' }],
    ['limit vượt trần', { limit: 500 }],
  ])('trả 400 khi %s', async (_label, query) => {
    const res = await request(app).get('/api/v1/chat/conversations').query(query).set(asUser());

    expect(res.status).toBe(400);
    expect(chatService.getMyConversations).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/chat/conversations', () => {
  it('mở hội thoại và trả 201', async () => {
    const res = await request(app)
      .post('/api/v1/chat/conversations')
      .send({ recipientId: RECIPIENT_ID })
      .set(asUser());

    expect(res.status).toBe(201);
    expect(chatService.openConversation).toHaveBeenCalledWith(USER_ID, { recipientId: RECIPIENT_ID });
  });

  it('chuyển ngữ cảnh xuống service', async () => {
    await request(app)
      .post('/api/v1/chat/conversations')
      .send({ recipientId: RECIPIENT_ID, contextType: ConversationContext.BOOKING, contextRef: BOOKING_ID })
      .set(asUser());

    expect(chatService.openConversation).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      contextType: ConversationContext.BOOKING,
      contextRef: BOOKING_ID,
    }));
  });

  it.each([
    ['thiếu người nhận', {}],
    ['id người nhận không đúng định dạng', { recipientId: 'không-phải-objectid' }],
    ['ngữ cảnh lạ', { recipientId: RECIPIENT_ID, contextType: 'zalo', contextRef: BOOKING_ID }],
    ['ngữ cảnh có ràng buộc mà thiếu id', { recipientId: RECIPIENT_ID, contextType: ConversationContext.BOOKING }],
  ])('trả 400 khi %s', async (_label, body) => {
    const res = await request(app).post('/api/v1/chat/conversations').send(body).set(asUser());

    expect(res.status).toBe(400);
    expect(chatService.openConversation).not.toHaveBeenCalled();
  });
});

describe('nhóm chat', () => {
  it('lập nhóm và trả 201', async () => {
    const res = await request(app)
      .post('/api/v1/chat/groups')
      .send({ name: 'Đội Sao Vàng', memberIds: [RECIPIENT_ID, MEMBER_ID] })
      .set(asUser());

    expect(res.status).toBe(201);
    expect(chatService.createGroup).toHaveBeenCalledWith(USER_ID, {
      name: 'Đội Sao Vàng',
      memberIds: [RECIPIENT_ID, MEMBER_ID],
    });
  });

  it.each([
    ['thiếu tên nhóm', { memberIds: [RECIPIENT_ID] }],
    ['tên nhóm rỗng', { name: '   ', memberIds: [RECIPIENT_ID] }],
    ['tên nhóm quá dài', { name: 'a'.repeat(GROUP_NAME_MAX_LENGTH + 1), memberIds: [RECIPIENT_ID] }],
    ['không mời ai', { name: 'Nhóm', memberIds: [] }],
    ['id thành viên sai định dạng', { name: 'Nhóm', memberIds: ['bạn-thân'] }],
    ['mời quá đông', {
      name: 'Nhóm',
      memberIds: Array.from({ length: GROUP_MAX_PARTICIPANTS + 1 }, () => RECIPIENT_ID),
    }],
  ])('trả 400 khi %s', async (_label, body) => {
    const res = await request(app).post('/api/v1/chat/groups').send(body).set(asUser());

    expect(res.status).toBe(400);
    expect(chatService.createGroup).not.toHaveBeenCalled();
  });

  it('đổi tên nhóm', async () => {
    const res = await request(app)
      .patch(`/api/v1/chat/conversations/${CONVERSATION_ID}`)
      .send({ name: 'Tên mới' })
      .set(asUser());

    expect(res.status).toBe(200);
    expect(chatService.updateGroup).toHaveBeenCalledWith(USER_ID, CONVERSATION_ID, { name: 'Tên mới' });
  });

  it.each([
    ['tên rỗng', { name: '   ' }],
    ['tên quá dài', { name: 'a'.repeat(GROUP_NAME_MAX_LENGTH + 1) }],
  ])('đổi tên nhóm trả 400 khi %s', async (_label, body) => {
    const res = await request(app)
      .patch(`/api/v1/chat/conversations/${CONVERSATION_ID}`)
      .send(body)
      .set(asUser());

    expect(res.status).toBe(400);
    expect(chatService.updateGroup).not.toHaveBeenCalled();
  });

  it('thêm thành viên', async () => {
    const res = await request(app)
      .post(`/api/v1/chat/conversations/${CONVERSATION_ID}/members`)
      .send({ memberIds: [MEMBER_ID] })
      .set(asUser());

    expect(res.status).toBe(200);
    expect(chatService.addMembers).toHaveBeenCalledWith(USER_ID, CONVERSATION_ID, [MEMBER_ID]);
  });

  it.each([
    ['không mời ai', { memberIds: [] }],
    ['id thành viên sai định dạng', { memberIds: ['bạn-thân'] }],
  ])('thêm thành viên trả 400 khi %s', async (_label, body) => {
    const res = await request(app)
      .post(`/api/v1/chat/conversations/${CONVERSATION_ID}/members`)
      .send(body)
      .set(asUser());

    expect(res.status).toBe(400);
    expect(chatService.addMembers).not.toHaveBeenCalled();
  });

  it('gỡ thành viên', async () => {
    const res = await request(app)
      .delete(`/api/v1/chat/conversations/${CONVERSATION_ID}/members/${MEMBER_ID}`)
      .set(asUser());

    expect(res.status).toBe(200);
    expect(chatService.removeMember).toHaveBeenCalledWith(USER_ID, CONVERSATION_ID, MEMBER_ID);
  });

  it('rời nhóm', async () => {
    const res = await request(app)
      .post(`/api/v1/chat/conversations/${CONVERSATION_ID}/leave`)
      .set(asUser());

    expect(res.status).toBe(200);
    expect(chatService.leaveGroup).toHaveBeenCalledWith(USER_ID, CONVERSATION_ID);
  });

  it('lỗi 403 của service (không phải quản trị nhóm) đi nguyên vẹn ra ngoài', async () => {
    chatService.addMembers.mockRejectedValue(new AppError('Only a group admin can do this', 403, 'FORBIDDEN'));

    const res = await request(app)
      .post(`/api/v1/chat/conversations/${CONVERSATION_ID}/members`)
      .send({ memberIds: [MEMBER_ID] })
      .set(asUser());

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/chat/conversations/:id/messages', () => {
  it('gửi tin nhắn và trả 201', async () => {
    const res = await request(app)
      .post(`/api/v1/chat/conversations/${CONVERSATION_ID}/messages`)
      .send({ body: 'Mai 18h nhé' })
      .set(asUser());

    expect(res.status).toBe(201);
    expect(chatService.sendMessage).toHaveBeenCalledWith(USER_ID, CONVERSATION_ID, 'Mai 18h nhé');
  });

  it.each([
    ['tin nhắn rỗng', { body: '' }],
    ['tin nhắn toàn khoảng trắng', { body: '    ' }],
    ['tin nhắn vượt trần độ dài', { body: 'a'.repeat(MESSAGE_MAX_LENGTH + 1) }],
    ['thiếu nội dung', {}],
  ])('trả 400 khi %s', async (_label, body) => {
    const res = await request(app)
      .post(`/api/v1/chat/conversations/${CONVERSATION_ID}/messages`)
      .send(body)
      .set(asUser());

    expect(res.status).toBe(400);
    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('lỗi 403 từ service đi nguyên vẹn ra ngoài', async () => {
    chatService.sendMessage.mockRejectedValue(new AppError('You are not a participant', 403, 'FORBIDDEN'));

    const res = await request(app)
      .post(`/api/v1/chat/conversations/${CONVERSATION_ID}/messages`)
      .send({ body: 'chen vào' })
      .set(asUser());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

describe('đọc tin nhắn', () => {
  it('limit vượt trần 100 thì bị từ chối', async () => {
    const res = await request(app)
      .get(`/api/v1/chat/conversations/${CONVERSATION_ID}/messages`)
      .query({ limit: 200 })
      .set(asUser());

    expect(res.status).toBe(400);
    expect(chatService.getMessages).not.toHaveBeenCalled();
  });

  it('lấy lịch sử kèm phân trang', async () => {
    const res = await request(app)
      .get(`/api/v1/chat/conversations/${CONVERSATION_ID}/messages`)
      .query({ page: 2, limit: 20 })
      .set(asUser());

    expect(res.status).toBe(200);
    expect(chatService.getMessages).toHaveBeenCalledWith(
      USER_ID, CONVERSATION_ID, expect.objectContaining({ page: 2, limit: 20 })
    );
  });

  it('đánh dấu đã đọc', async () => {
    const res = await request(app)
      .post(`/api/v1/chat/conversations/${CONVERSATION_ID}/read`)
      .set(asUser());

    expect(res.status).toBe(200);
    expect(chatService.markRead).toHaveBeenCalledWith(USER_ID, CONVERSATION_ID);
  });

  it('mở thẳng một hội thoại bằng link, không cần hộp thư', async () => {
    const res = await request(app).get(`/api/v1/chat/conversations/${CONVERSATION_ID}`).set(asUser());

    expect(res.status).toBe(200);
    expect(chatService.getConversation).toHaveBeenCalledWith(USER_ID, CONVERSATION_ID);
  });

  it('trả tổng chưa đọc cho chấm đỏ', async () => {
    chatService.countUnread.mockResolvedValue(5);

    const res = await request(app).get('/api/v1/chat/unread-count').set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(5);
  });
});
