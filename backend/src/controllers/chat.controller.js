const chatService = require('../services/chat.service');
const { sendSuccess, paginationMeta } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');

const getMyConversations = catchAsync(async (req, res) => {
  const [{ conversations, total, page, limit }, unreadCount] = await Promise.all([
    chatService.getMyConversations(req.user.id, req.query),
    chatService.countUnread(req.user.id),
  ]);
  // Hộp thư cần cả danh sách lẫn tổng chưa đọc — trả kèm để client khỏi gọi thêm một vòng
  sendSuccess(res, { conversations, unreadCount }, 'Conversations retrieved', HttpStatus.OK, {
    pagination: paginationMeta(total, page, limit),
  });
});

const openConversation = catchAsync(async (req, res) => {
  const conversation = await chatService.openConversation(req.user.id, req.body);
  sendSuccess(res, { conversation }, 'Conversation opened', HttpStatus.CREATED);
});

const createGroup = catchAsync(async (req, res) => {
  const conversation = await chatService.createGroup(req.user.id, req.body);
  sendSuccess(res, { conversation }, 'Group created', HttpStatus.CREATED);
});

const getConversation = catchAsync(async (req, res) => {
  const conversation = await chatService.getConversation(req.user.id, req.params.id);
  sendSuccess(res, { conversation });
});

const updateGroup = catchAsync(async (req, res) => {
  const conversation = await chatService.updateGroup(req.user.id, req.params.id, req.body);
  sendSuccess(res, { conversation }, 'Group updated');
});

const addMembers = catchAsync(async (req, res) => {
  const conversation = await chatService.addMembers(req.user.id, req.params.id, req.body.memberIds);
  sendSuccess(res, { conversation }, 'Members added');
});

const removeMember = catchAsync(async (req, res) => {
  const conversation = await chatService.removeMember(req.user.id, req.params.id, req.params.memberId);
  sendSuccess(res, { conversation }, 'Member removed');
});

const leaveGroup = catchAsync(async (req, res) => {
  const result = await chatService.leaveGroup(req.user.id, req.params.id);
  sendSuccess(res, result, 'You left the group');
});

const getUnreadCount = catchAsync(async (req, res) => {
  const unreadCount = await chatService.countUnread(req.user.id);
  sendSuccess(res, { unreadCount });
});

const getMessages = catchAsync(async (req, res) => {
  const { messages, total, page, limit } = await chatService.getMessages(
    req.user.id, req.params.id, req.query
  );
  sendSuccess(res, { messages }, 'Messages retrieved', HttpStatus.OK, {
    pagination: paginationMeta(total, page, limit),
  });
});

const sendMessage = catchAsync(async (req, res) => {
  const { message } = await chatService.sendMessage(req.user.id, req.params.id, req.body.body);
  sendSuccess(res, { message }, 'Message sent', HttpStatus.CREATED);
});

const markRead = catchAsync(async (req, res) => {
  const result = await chatService.markRead(req.user.id, req.params.id);
  sendSuccess(res, result, 'Conversation marked as read');
});

module.exports = {
  getMyConversations, openConversation, createGroup, getConversation, updateGroup,
  addMembers, removeMember, leaveGroup,
  getUnreadCount, getMessages, sendMessage, markRead,
};
