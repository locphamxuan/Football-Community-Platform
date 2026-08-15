const { Router } = require('express');
const controller = require('../controllers/chat.controller');
const authenticate = require('../middleware/authenticate');
const denyRoles = require('../middleware/denyRoles');
const validate = require('../middleware/validate');
const Role = require('../constants/roles');
const {
  openConversationSchema, createGroupSchema, updateGroupSchema, addMembersSchema,
  sendMessageBodySchema, conversationQuerySchema, messageQuerySchema,
} = require('../validations/chat.validation');

const router = Router();

/**
 * Không có `authorize(...)` ở đâu cả: chủ sân, quản lý đội và người chơi đều nhắn tin, và
 * ai được nói chuyện với ai là câu hỏi về **quan hệ** (có phải hai bên của lịch đặt này không,
 * có trong nhóm này không) chứ không phải về vai trò. Câu hỏi đó chỉ trả lời được khi đã biết
 * hội thoại nào, nên nó nằm trong `chat.service` chứ không phải ở đây.
 *
 * Ngoại lệ duy nhất là quản trị viên nền tảng: họ đứng ngoài mọi cuộc trò chuyện, nên chặn
 * ngay ở cửa thay vì để service từ chối từng thao tác một.
 *
 * Toàn bộ đường REST này có bản song song bằng WebSocket (xem `src/socket/`). Nó vẫn cần thiết:
 * lịch sử hội thoại phải tải được lúc mở màn hình, và client mất kết nối vẫn phải gửi được tin.
 */
router.use(authenticate, denyRoles(Role.ADMIN));

router.get('/conversations', validate(conversationQuerySchema, 'query'), controller.getMyConversations);
router.post('/conversations', validate(openConversationSchema), controller.openConversation);
router.get('/unread-count', controller.getUnreadCount);

router.post('/groups', validate(createGroupSchema), controller.createGroup);

router.get('/conversations/:id', controller.getConversation);
router.patch('/conversations/:id', validate(updateGroupSchema), controller.updateGroup);
router.get('/conversations/:id/messages', validate(messageQuerySchema, 'query'), controller.getMessages);
router.post('/conversations/:id/messages', validate(sendMessageBodySchema), controller.sendMessage);
router.post('/conversations/:id/read', controller.markRead);

router.post('/conversations/:id/members', validate(addMembersSchema), controller.addMembers);
router.delete('/conversations/:id/members/:memberId', controller.removeMember);
router.post('/conversations/:id/leave', controller.leaveGroup);

module.exports = router;
