/**
 * Kết nối socket.io thật, đi trọn vẹn từ lúc bắt tay tới lúc tin nhắn hiện ra ở máy người kia.
 *
 * Chỉ tầng service bị mock — đúng như các test HTTP. Phần đáng kiểm ở đây không phải là
 * nghiệp vụ (`chat.service.test.js` đã lo) mà là những thứ chỉ sai khi có kết nối thật:
 * token bị từ chối lúc bắt tay, payload hỏng, và tin nhắn có thực sự tới đúng người hay không.
 *
 * `socket/index.js` không dùng được ở đây vì nó gắn redis adapter — test không có Redis thật,
 * nên server ở đây dựng thẳng bằng đúng hai mảnh còn lại: `auth` và `handlers`.
 */
jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/chat');

const http = require('http');
const { Server } = require('socket.io');
const { io: createClient } = require('socket.io-client');

const chatService = require('../../src/services/chat');
const authenticateSocket = require('../../src/socket/auth');
const registerHandlers = require('../../src/socket/handlers');
const { setIo, emitToUsers } = require('../../src/socket/emitter');
const { ClientEvent, ServerEvent } = require('../../src/socket/events');
const { AppError } = require('../../src/middleware/errorHandler');
const { tokenFor, USER_ID } = require('../helpers/auth');
const { generateAccessToken } = require('../../src/utils/jwt');
const { cache, CacheKeys, resetCache } = require('../helpers/fakeRedis');
const Role = require('../../src/constants/roles');

const OTHER_ID = '000000000000000000000002';
const CONVERSATION_ID = '000000000000000000000010';

let httpServer;
let io;
let port;
const clients = [];

const connect = (token) => new Promise((resolve, reject) => {
  const client = createClient(`http://localhost:${port}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  });
  clients.push(client);
  client.on('connect', () => resolve(client));
  client.on('connect_error', reject);
});

/**
 * Web không còn đặt được `auth.token` — access token nằm trong cookie httpOnly, JS không đọc
 * được. Trình duyệt tự đính kèm cookie ở request bắt tay; ở đây giả lập bằng `extraHeaders`.
 */
const connectWithCookie = (token) => new Promise((resolve, reject) => {
  const client = createClient(`http://localhost:${port}`, {
    extraHeaders: token ? { Cookie: `accessToken=${token}` } : undefined,
    transports: ['websocket'],
    reconnection: false,
  });
  clients.push(client);
  client.on('connect', () => resolve(client));
  client.on('connect_error', reject);
});

/** Chờ đúng một sự kiện, thất bại nhanh thay vì treo tới lúc jest hết giờ. */
const waitFor = (client, event) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Không nhận được sự kiện ${event}`)), 2000);
  client.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
});

beforeAll((done) => {
  httpServer = http.createServer();
  io = new Server(httpServer);
  io.use(authenticateSocket);
  io.on('connection', registerHandlers);
  setIo(io);

  httpServer.listen(() => { port = httpServer.address().port; done(); });
});

afterAll(async () => {
  setIo(null);
  await io.close();
  httpServer.close();
});

beforeEach(() => {
  resetCache();
  chatService.sendMessage.mockResolvedValue({ message: { _id: '000000000000000000000099', body: 'Mai 18h nhé' } });
  chatService.markRead.mockResolvedValue({ conversationId: CONVERSATION_ID, readAt: new Date() });
  chatService.notifyTyping.mockResolvedValue(undefined);
});

afterEach(() => {
  while (clients.length) clients.pop().disconnect();
});

describe('bắt tay', () => {
  it('token hợp lệ thì vào được', async () => {
    await expect(connect(tokenFor(Role.USER))).resolves.toBeDefined();
  });

  it.each([
    ['không có token', undefined],
    ['token bịa', 'không-phải-jwt'],
  ])('từ chối khi %s', async (_label, token) => {
    await expect(connect(token)).rejects.toThrow();
  });

  it('quản trị viên nền tảng bị từ chối ngay ở cửa, giống đường REST', async () => {
    await expect(connect(tokenFor(Role.USER, Role.ADMIN))).rejects.toThrow();
  });

  it('token đã logout bị chặn ngay ở cửa, không chỉ ở REST', async () => {
    const { token, jti } = generateAccessToken(USER_ID, 'probe@example.com', [Role.USER]);
    await cache.set(CacheKeys.blacklistedToken(jti), '1');

    await expect(connect(token)).rejects.toThrow();
  });

  it('web vào được bằng cookie accessToken, không cần auth.token', async () => {
    await expect(connectWithCookie(tokenFor(Role.USER))).resolves.toBeDefined();
  });

  it('không có auth.token lẫn cookie thì bị từ chối', async () => {
    await expect(connectWithCookie(undefined)).rejects.toThrow();
  });
});

describe('gửi tin nhắn', () => {
  it('đẩy xuống service kèm id người gửi lấy từ token, không phải từ payload', async () => {
    const client = await connect(tokenFor(Role.USER));

    const ack = await client.emitWithAck(ClientEvent.SEND_MESSAGE, {
      conversationId: CONVERSATION_ID,
      body: 'Mai 18h nhé',
      // Client tự khai mình là người khác — server phải bỏ qua hoàn toàn.
      senderId: OTHER_ID,
    });

    expect(ack.success).toBe(true);
    expect(chatService.sendMessage).toHaveBeenCalledWith(USER_ID, CONVERSATION_ID, 'Mai 18h nhé');
  });

  it('tin nhắn tới được thiết bị khác của cùng một người', async () => {
    const phone = await connect(tokenFor(Role.USER));
    const laptop = await connect(tokenFor(Role.USER));

    const arrived = waitFor(laptop, ServerEvent.NEW_MESSAGE);
    emitToUsers([USER_ID], ServerEvent.NEW_MESSAGE, { conversationId: CONVERSATION_ID });
    await expect(arrived).resolves.toMatchObject({ conversationId: CONVERSATION_ID });

    phone.disconnect();
  });

  it.each([
    ['tin nhắn rỗng', { conversationId: CONVERSATION_ID, body: '   ' }],
    ['thiếu id hội thoại', { body: 'xin chào' }],
    ['id hội thoại không đúng định dạng', { conversationId: 'abc', body: 'xin chào' }],
  ])('%s bị chặn y như đường REST', async (_label, payload) => {
    const client = await connect(tokenFor(Role.USER));

    const ack = await client.emitWithAck(ClientEvent.SEND_MESSAGE, payload);

    expect(ack.success).toBe(false);
    expect(ack.code).toBe('VALIDATION_ERROR');
    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('lỗi nghiệp vụ trả về nguyên văn cho client, không giết tiến trình', async () => {
    chatService.sendMessage.mockRejectedValue(new AppError('You are not a participant', 403, 'FORBIDDEN'));
    const client = await connect(tokenFor(Role.USER));

    const ack = await client.emitWithAck(ClientEvent.SEND_MESSAGE, {
      conversationId: CONVERSATION_ID, body: 'chen vào',
    });

    expect(ack).toMatchObject({ success: false, code: 'FORBIDDEN', message: 'You are not a participant' });
  });

  it('lỗi ngoài dự kiến không lộ chi tiết ra ngoài', async () => {
    chatService.sendMessage.mockRejectedValue(new Error('Mongo down at 10.0.0.4'));
    const client = await connect(tokenFor(Role.USER));

    const ack = await client.emitWithAck(ClientEvent.SEND_MESSAGE, {
      conversationId: CONVERSATION_ID, body: 'xin chào',
    });

    expect(ack.success).toBe(false);
    expect(ack.message).toBe('Something went wrong');
    expect(ack.message).not.toContain('10.0.0.4');
  });

  it('client không dùng ack vẫn nhận được lỗi qua sự kiện riêng', async () => {
    chatService.sendMessage.mockRejectedValue(new AppError('Too many messages', 429, 'TOO_MANY_REQUESTS'));
    const client = await connect(tokenFor(Role.USER));

    const failure = waitFor(client, ServerEvent.ERROR);
    client.emit(ClientEvent.SEND_MESSAGE, { conversationId: CONVERSATION_ID, body: 'spam' });

    await expect(failure).resolves.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });
});

describe('đã đọc và đang nhập', () => {
  it('đánh dấu đã đọc đi qua service', async () => {
    const client = await connect(tokenFor(Role.USER));

    const ack = await client.emitWithAck(ClientEvent.MARK_READ, { conversationId: CONVERSATION_ID });

    expect(ack.success).toBe(true);
    expect(chatService.markRead).toHaveBeenCalledWith(USER_ID, CONVERSATION_ID);
  });

  it('"đang nhập" mặc định là true khi client không nói gì thêm', async () => {
    const client = await connect(tokenFor(Role.USER));

    await client.emitWithAck(ClientEvent.TYPING, { conversationId: CONVERSATION_ID });

    expect(chatService.notifyTyping).toHaveBeenCalledWith(USER_ID, CONVERSATION_ID, true);
  });
});
