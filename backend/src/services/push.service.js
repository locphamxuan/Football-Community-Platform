const User = require('../models/User');
const logger = require('../utils/logger');

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Expo nhận tối đa 100 tin mỗi lần gọi.
const MAX_MESSAGES_PER_REQUEST = 100;

/** Token do Expo cấp luôn có dạng này; gửi chuỗi khác chỉ tốn một vòng gọi mạng để bị từ chối. */
const isExpoPushToken = (token) => /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Token bị Expo trả về `DeviceNotRegistered` là token của app đã gỡ hoặc đã tắt thông báo.
 * Giữ lại chỉ khiến mọi lần gửi sau đều thất bại, nên xoá luôn khỏi hồ sơ.
 */
const dropDeadTokens = async (userId, tokens) => {
  if (tokens.length === 0) return;
  await User.findByIdAndUpdate(userId, { $pull: { expoPushTokens: { $in: tokens } } });
  logger.info(`Removed ${tokens.length} dead Expo push token(s) for user ${userId}`);
};

/**
 * Đẩy thông báo tới mọi thiết bị của một người dùng.
 *
 * Cùng hợp đồng với `notify()`: **không bao giờ ném lỗi**. Expo là dịch vụ ngoài, nó
 * chậm hoặc chết là chuyện bình thường và không được kéo theo hành động gốc.
 * Thông báo in-app đã nằm trong MongoDB rồi — đẩy chỉ là lớp báo sớm.
 */
const sendExpoPush = async (user, { title, body, link }) => {
  const tokens = (user.expoPushTokens ?? []).filter(isExpoPushToken);
  if (tokens.length === 0) return { sent: 0 };
  if (user.notifications?.push === false) return { sent: 0 };

  let sent = 0;
  try {
    for (const batch of chunk(tokens, MAX_MESSAGES_PER_REQUEST)) {
      const messages = batch.map((to) => ({ to, title, body, data: { link }, sound: 'default' }));

      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        logger.error(`Expo push responded ${res.status}`);
        return { sent };
      }

      // eslint-disable-next-line no-await-in-loop
      const payload = await res.json();
      const tickets = Array.isArray(payload?.data) ? payload.data : [];

      const dead = tickets
        .map((ticket, i) => (ticket?.details?.error === 'DeviceNotRegistered' ? batch[i] : null))
        .filter(Boolean);
      // eslint-disable-next-line no-await-in-loop
      await dropDeadTokens(user._id, dead);

      sent += tickets.filter((ticket) => ticket?.status === 'ok').length;
    }
  } catch (err) {
    logger.error('Expo push failed:', err.message);
  }

  return { sent };
};

module.exports = { sendExpoPush, isExpoPushToken };
