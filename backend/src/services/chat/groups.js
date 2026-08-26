const mongoose = require('mongoose');
const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const User = require('../../models/User');
const { ConversationType, ParticipantRole, GROUP_MAX_PARTICIPANTS } = require('../../constants/chat');
const {
  invalid, notFound, idOf, loadForParticipant, participantIdsOf, assertGroupAdmin,
  reloadConversation, emitConversation, postSystemMessage, nameOf, loadChattableUsers,
} = require('./helpers');

// ─── createGroup ──────────────────────────────────────────────────────────────
/**
 * Lập một nhóm. Người lập là quản trị nhóm.
 *
 * `_id` được sinh trước khi ghi để `key` dựng được từ nó: nhóm không có cặp người nào để
 * chống trùng, nhưng chỉ mục unique trên `key` thì dùng chung với hội thoại tay đôi.
 */
const createGroup = async (userId, { name, memberIds }) => {
  const others = [...new Set(memberIds.map(idOf))].filter((id) => id !== idOf(userId));
  if (!others.length) throw invalid('A group needs at least one other member');
  if (others.length + 1 > GROUP_MAX_PARTICIPANTS) {
    throw invalid(`A group cannot hold more than ${GROUP_MAX_PARTICIPANTS} members`);
  }

  await loadChattableUsers(others);

  const _id = new mongoose.Types.ObjectId();
  const conversation = await Conversation.create({
    _id,
    key: Conversation.buildGroupKey(_id),
    type: ConversationType.GROUP,
    name,
    createdBy: userId,
    participants: [
      { user: userId, role: ParticipantRole.ADMIN },
      ...others.map((user) => ({ user, role: ParticipantRole.MEMBER })),
    ],
  });

  const actor = await User.findById(userId).select('fullName username');
  await postSystemMessage(conversation, userId, `${nameOf(actor)} đã tạo nhóm "${name}"`);

  const populated = await reloadConversation(_id);
  emitConversation(participantIdsOf(conversation), populated);
  return populated;
};

// ─── addMembers ───────────────────────────────────────────────────────────────
const addMembers = async (userId, conversationId, memberIds) => {
  const conversation = await loadForParticipant(conversationId, userId);
  assertGroupAdmin(conversation, userId);

  const current = new Set(participantIdsOf(conversation).map(idOf));
  const added = [...new Set(memberIds.map(idOf))].filter((id) => !current.has(id));
  if (!added.length) throw invalid('These users are already in the group');
  if (current.size + added.length > GROUP_MAX_PARTICIPANTS) {
    throw invalid(`A group cannot hold more than ${GROUP_MAX_PARTICIPANTS} members`);
  }

  const users = await loadChattableUsers(added);

  await Conversation.updateOne(
    { _id: conversationId },
    { $push: { participants: { $each: added.map((user) => ({ user, role: ParticipantRole.MEMBER })) } } }
  );

  const actor = await User.findById(userId).select('fullName username');
  const updated = await reloadConversation(conversationId);
  await postSystemMessage(updated, userId, `${nameOf(actor)} đã thêm ${users.map(nameOf).join(', ')} vào nhóm`);

  emitConversation(participantIdsOf(updated), updated);
  return updated;
};

// ─── removeMember ─────────────────────────────────────────────────────────────
const removeMember = async (userId, conversationId, memberId) => {
  const conversation = await loadForParticipant(conversationId, userId);
  assertGroupAdmin(conversation, userId);

  if (idOf(memberId) === idOf(userId)) throw invalid('Leave the group instead of removing yourself');
  if (!participantIdsOf(conversation).some((id) => idOf(id) === idOf(memberId))) {
    throw notFound('This user is not in the group');
  }

  await Conversation.updateOne(
    { _id: conversationId },
    { $pull: { participants: { user: new mongoose.Types.ObjectId(idOf(memberId)) } } }
  );

  const [actor, removed] = await Promise.all([
    User.findById(userId).select('fullName username'),
    User.findById(memberId).select('fullName username'),
  ]);
  const updated = await reloadConversation(conversationId);
  await postSystemMessage(updated, userId, `${nameOf(actor)} đã gỡ ${nameOf(removed)} khỏi nhóm`);

  // Người bị gỡ cũng phải nhận sự kiện, nếu không nhóm vẫn nằm trong hộp thư của họ
  // cho tới lần tải lại trang tiếp theo.
  emitConversation([...participantIdsOf(updated), memberId], updated);
  return updated;
};

// ─── leaveGroup ───────────────────────────────────────────────────────────────
/**
 * Rời nhóm là quyền của mọi thành viên, kể cả quản trị.
 *
 * Người cuối cùng rời đi thì nhóm và toàn bộ tin nhắn biến mất: giữ lại một nhóm rỗng
 * là giữ một đống dữ liệu không ai mở được nữa. Còn quản trị cuối cùng rời đi thì người
 * kỳ cựu nhất lên thay, nếu không nhóm kẹt vĩnh viễn ở trạng thái không ai thêm được ai.
 */
const leaveGroup = async (userId, conversationId) => {
  const conversation = await loadForParticipant(conversationId, userId);
  if (conversation.type !== ConversationType.GROUP) throw invalid('This conversation is not a group');

  const remaining = conversation.participants.filter((p) => idOf(p.user) !== idOf(userId));

  if (!remaining.length) {
    await Promise.all([
      Conversation.deleteOne({ _id: conversationId }),
      Message.deleteMany({ conversation: conversationId }),
    ]);
    return { conversationId: idOf(conversationId), deleted: true };
  }

  await Conversation.updateOne(
    { _id: conversationId },
    { $pull: { participants: { user: new mongoose.Types.ObjectId(idOf(userId)) } } }
  );

  if (!remaining.some((p) => p.role === ParticipantRole.ADMIN)) {
    await Conversation.updateOne(
      { _id: conversationId, 'participants.user': remaining[0].user },
      { $set: { 'participants.$.role': ParticipantRole.ADMIN } }
    );
  }

  const actor = await User.findById(userId).select('fullName username');
  const updated = await reloadConversation(conversationId);
  await postSystemMessage(updated, userId, `${nameOf(actor)} đã rời nhóm`);

  emitConversation([...participantIdsOf(updated), userId], updated);
  return { conversationId: idOf(conversationId), deleted: false };
};

// ─── updateGroup ──────────────────────────────────────────────────────────────
const updateGroup = async (userId, conversationId, { name }) => {
  const conversation = await loadForParticipant(conversationId, userId);
  assertGroupAdmin(conversation, userId);

  await Conversation.updateOne({ _id: conversationId }, { $set: { name } });

  const actor = await User.findById(userId).select('fullName username');
  const updated = await reloadConversation(conversationId);
  await postSystemMessage(updated, userId, `${nameOf(actor)} đã đổi tên nhóm thành "${name}"`);

  emitConversation(participantIdsOf(updated), updated);
  return updated;
};

module.exports = { createGroup, addMembers, removeMember, leaveGroup, updateGroup };
