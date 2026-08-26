const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const Team = require('../../models/Team');
const { getPagination } = require('../../utils/pagination');
const { dayRangeUtc } = require('./helpers');

// ─── getTeamBookings ───────────────────────────────────────────────────────────
/**
 * Lịch sân của các đội mà user đang dẫn dắt — gồm cả lịch do thành viên khác đặt cho đội.
 * Thành viên thường xem lịch của chính mình ở /my-bookings.
 */
const getTeamBookings = async (userId, query) => {
  const { page, limit, skip } = getPagination(query);

  const teamFilter = { manager: new mongoose.Types.ObjectId(userId), status: { $ne: 'disbanded' } };
  if (query.teamId) teamFilter._id = new mongoose.Types.ObjectId(query.teamId);
  const teamIds = await Team.find(teamFilter).distinct('_id');
  if (teamIds.length === 0) return { bookings: [], total: 0, page, limit };

  const filter = { team: { $in: teamIds } };
  if (query.status) filter.status = query.status;
  if (query.startDate) filter.date = { $gte: dayRangeUtc(query.startDate).start };
  if (query.endDate) filter.date = { ...(filter.date || {}), $lt: dayRangeUtc(query.endDate).end };

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('field', 'name location images')
      .populate('team', 'name logo')
      .populate('user', 'username fullName avatar phone')
      .skip(skip)
      .limit(limit)
      .sort({ date: -1, startTime: -1 }),
    Booking.countDocuments(filter),
  ]);
  return { bookings, total, page, limit };
};

module.exports = { getTeamBookings };
