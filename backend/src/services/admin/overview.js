const User = require('../../models/User');
const Field = require('../../models/Field');
const Booking = require('../../models/Booking');
const Team = require('../../models/Team');
const Review = require('../../models/Review');
const Subscription = require('../../models/Subscription');
const Invoice = require('../../models/Invoice');
const { PLANS, SubscriptionStatus, InvoiceStatus } = require('../../constants/plans');
const Role = require('../../constants/roles');

const monthStart = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// ─── getPlatformOverview ──────────────────────────────────────────────────────
/**
 * Bức tranh toàn nền tảng cho admin.
 * Tách bạch hai dòng tiền: GMV là tiền khách trả cho chủ sân (không phải doanh thu của nền tảng),
 * platformRevenue là tiền thuê bao chủ sân trả cho nền tảng.
 */
const getPlatformOverview = async () => {
  const now = new Date();
  const startOfMonth = monthStart(now);

  const [
    totalUsers,
    newUsersThisMonth,
    usersByRole,
    usersByStatus,
    fieldStatusCounts,
    totalTeams,
    totalReviews,
    bookingAgg,
    bookingsThisMonthAgg,
    subscriptionAgg,
    invoicePaidAgg,
    invoicePaidThisMonthAgg,
    outstandingAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.aggregate([{ $unwind: '$roles' }, { $group: { _id: '$roles', count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Field.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Team.countDocuments({ status: 'active' }),
    Review.countDocuments(),
    Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          value: { $sum: '$totalPrice' },
        },
      },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]),
    Subscription.aggregate([
      { $group: { _id: { plan: '$plan', status: '$status' }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { status: InvoiceStatus.PAID } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { status: InvoiceStatus.PAID, paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Invoice.aggregate([
      { $match: { status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.AWAITING_CONFIRMATION] } } },
      { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const roleCounts = Object.fromEntries(usersByRole.map((r) => [r._id, r.count]));
  const statusCounts = Object.fromEntries(usersByStatus.map((r) => [r._id, r.count]));
  const fieldCounts = Object.fromEntries(fieldStatusCounts.map((r) => [r._id, r.count]));
  const bookingByStatus = Object.fromEntries(bookingAgg.map((b) => [b._id, { count: b.count, value: b.value }]));
  const outstandingByStatus = Object.fromEntries(outstandingAgg.map((o) => [o._id, { count: o.count, total: o.total }]));

  // MRR: tổng giá niêm yết của các thuê bao trả phí đang hoạt động
  const planDistribution = Object.values(PLANS).map((plan) => ({
    code: plan.code,
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    total: subscriptionAgg
      .filter((s) => s._id.plan === plan.code)
      .reduce((sum, s) => sum + s.count, 0),
    active: subscriptionAgg
      .filter((s) => s._id.plan === plan.code && s._id.status === SubscriptionStatus.ACTIVE)
      .reduce((sum, s) => sum + s.count, 0),
  }));
  const mrr = planDistribution.reduce((sum, p) => sum + p.active * p.monthlyPrice, 0);

  const totalBookings = bookingAgg.reduce((sum, b) => sum + b.count, 0);

  return {
    users: {
      total: totalUsers,
      newThisMonth: newUsersThisMonth,
      owners: roleCounts[Role.FIELD_OWNER] ?? 0,
      managers: roleCounts[Role.TEAM_MANAGER] ?? 0,
      admins: roleCounts[Role.ADMIN] ?? 0,
      active: statusCounts.active ?? 0,
      banned: statusCounts.banned ?? 0,
    },
    fields: {
      total: Object.values(fieldCounts).reduce((sum, n) => sum + n, 0),
      active: fieldCounts.active ?? 0,
      inactive: fieldCounts.inactive ?? 0,
      pendingApproval: fieldCounts.pending_approval ?? 0,
    },
    teams: { total: totalTeams },
    reviews: { total: totalReviews },
    bookings: {
      total: totalBookings,
      thisMonth: bookingsThisMonthAgg[0]?.count ?? 0,
      pending: bookingByStatus.pending?.count ?? 0,
      completed: bookingByStatus.completed?.count ?? 0,
      cancelled: bookingByStatus.cancelled?.count ?? 0,
      /** Tổng giá trị booking đã hoàn thành — tiền của chủ sân, nền tảng không thu khoản này. */
      grossMerchandiseValue: bookingByStatus.completed?.value ?? 0,
    },
    platformRevenue: {
      totalCollected: invoicePaidAgg[0]?.total ?? 0,
      paidInvoices: invoicePaidAgg[0]?.count ?? 0,
      collectedThisMonth: invoicePaidThisMonthAgg[0]?.total ?? 0,
      mrr,
      pendingAmount: outstandingByStatus[InvoiceStatus.PENDING]?.total ?? 0,
      awaitingConfirmationCount: outstandingByStatus[InvoiceStatus.AWAITING_CONFIRMATION]?.count ?? 0,
      awaitingConfirmationAmount: outstandingByStatus[InvoiceStatus.AWAITING_CONFIRMATION]?.total ?? 0,
    },
    planDistribution,
  };
};

// ─── getRevenueSeries ─────────────────────────────────────────────────────────
/** Chuỗi số liệu theo tháng: tiền thuê bao thu được, số booking, số user mới. */
const getRevenueSeries = async (months = 12) => {
  const span = Math.min(Math.max(Number(months) || 12, 1), 24);
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (span - 1), 1);

  const groupByMonth = {
    _id: { y: { $year: '$__d' }, m: { $month: '$__d' } },
  };

  const [revenue, bookings, users] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: InvoiceStatus.PAID, paidAt: { $gte: from } } },
      { $addFields: { __d: '$paidAt' } },
      { $group: { ...groupByMonth, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $addFields: { __d: '$createdAt' } },
      {
        $group: {
          ...groupByMonth,
          count: { $sum: 1 },
          gmv: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalPrice', 0] } },
        },
      },
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $addFields: { __d: '$createdAt' } },
      { $group: { ...groupByMonth, count: { $sum: 1 } } },
    ]),
  ]);

  const index = (rows) =>
    Object.fromEntries(rows.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r]));
  const revenueIdx = index(revenue);
  const bookingIdx = index(bookings);
  const userIdx = index(users);

  const series = [];
  for (let i = 0; i < span; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const key = monthKey(d);
    series.push({
      month: key,
      label: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
      platformRevenue: revenueIdx[key]?.total ?? 0,
      paidInvoices: revenueIdx[key]?.count ?? 0,
      bookings: bookingIdx[key]?.count ?? 0,
      grossMerchandiseValue: bookingIdx[key]?.gmv ?? 0,
      newUsers: userIdx[key]?.count ?? 0,
    });
  }
  return series;
};

module.exports = { getPlatformOverview, getRevenueSeries };
