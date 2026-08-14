jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/chat.service');

const request = require('supertest');
const app = require('../../src/app');
const chatService = require('../../src/services/chat.service');
const { AppError } = require('../../src/middleware/errorHandler');
const { asUser, USER_ID } = require('../helpers/auth');
const { ConversationContext, MESSAGE_MAX_LENGTH } = require('../../src/constants/chat');

const CONVERSATION_ID = '000000000000000000000010';
const RECIPIENT_ID = '000000000000000000000002';
const BOOKING_ID = '000000000000000000000020';

beforeEach(() => {
  chatService.getMyConversations.mockResolvedValue({ conversations: [], total: 0, page: 1, limit: 10 });
  chatService.countUnread.mockResolvedValue(0);
  chatService.getMessages.mockResolvedValue({ messages: [], total: 0, page: 1, limit: 10 });
  chatService.openConversation.mockResolvedValue({ _id: CONVERSATION_ID });
  chatService.sendMessage.mockResolvedValue({ message: { _id: '000000000000000000000099' } });
  chatService.markRead.mockResolvedValue({ conversationId: CONVERSATION_ID, readAt: new Date() });
});

describe('toàn bộ /api/v1/chat cần đăng nhập', () => {
  it.each([
    ['get', '/api/v1/chat/conversations'],
    ['post', '/api/v1/chat/conversations'],
    ['get', '/api/v1/chat/unread-count'],
    ['get', `/api/v1/chat/conversations/${CONVERSATION_ID}/messages`],
    ['post', `/api/v1/chat/conversations/${CONVERSATION_ID}/messages`],
    ['post', `/api/v1/chat/conversations/${CONVERSATION_ID}/read`],
  ])('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
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

  it('trả tổng chưa đọc cho chấm đỏ', async () => {
    chatService.countUnread.mockResolvedValue(5);

    const res = await request(app).get('/api/v1/chat/unread-count').set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(5);
  });
});
