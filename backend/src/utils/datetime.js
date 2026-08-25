/**
 * Nhãn khung giờ cho người đọc: "24/08/2026 18:00–20:00".
 *
 * Ngày được cắt theo UTC vì booking và lời mời thi đấu đều lưu bằng
 * `new Date('YYYY-MM-DD')` = nửa đêm UTC; đọc theo giờ địa phương sẽ lệch một ngày
 * trên server nằm ở múi giờ khác.
 */
const formatSlotLabel = (date, startTime, endTime) => {
  const [y, m, d] = new Date(date).toISOString().slice(0, 10).split('-');
  return `${d}/${m}/${y} ${startTime}–${endTime}`;
};

/** "18:00" → 1080 (số phút kể từ 00:00). */
const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

module.exports = { formatSlotLabel, toMinutes };
