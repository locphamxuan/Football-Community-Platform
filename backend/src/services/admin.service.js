const mongoose = require('mongoose');
const User = require('../models/User');
const Field = require('../models/Field');
const Booking = require('../models/Booking');
const Team = require('../models/Team');
const Review = require('../models/Review');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const billingService = require('./billing.service');
const adminAuditLogService = require('./adminAuditLog.service');
const { getPagination } = require('../utils/pagination');
const { PLANS, getPlan, SubscriptionStatus, InvoiceStatus } = require('../constants/plans');
const { AdminAction, AdminTargetType } = require('../constants/adminAudit');
const Role = require('../constants/roles');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

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

// ─── getOwners ────────────────────────────────────────────────────────────────
/** Danh sách chủ sân kèm mức sử dụng và số tiền đã trả cho nền tảng. */
const getOwners = async (query) => {
  const { page, limit, skip } = getPagination(query);

  const match = { roles: Role.FIELD_OWNER };
  if (query.search) {
    match.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { username: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }
  if (query.plan) {
    const ids = await Subscription.find({ plan: query.plan }).distinct('owner');
    match._id = { $in: ids };
  }

  const [owners, total] = await Promise.all([
    User.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $lookup: { from: 'fields', localField: '_id', foreignField: 'owner', as: 'fields' } },
      { $lookup: { from: 'subscriptions', localField: '_id', foreignField: 'owner', as: 'subscription' } },
      {
        $lookup: {
          from: 'bookings',
          let: { fieldIds: '$fields._id' },
          pipeline: [
            { $match: { $expr: { $in: ['$field', '$$fieldIds'] } } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                gmv: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalPrice', 0] } },
              },
            },
          ],
          as: 'bookingAgg',
        },
      },
      {
        $project: {
          _id: 1,
          username: 1,
          fullName: 1,
          email: 1,
          avatar: 1,
          phone: 1,
          status: 1,
          createdAt: 1,
          totalFields: { $size: '$fields' },
          activeFields: {
            $size: { $filter: { input: '$fields', as: 'f', cond: { $eq: ['$$f.status', 'active'] } } },
          },
          totalBookings: { $ifNull: [{ $arrayElemAt: ['$bookingAgg.total', 0] }, 0] },
          completedBookings: { $ifNull: [{ $arrayElemAt: ['$bookingAgg.completed', 0] }, 0] },
          grossMerchandiseValue: { $ifNull: [{ $arrayElemAt: ['$bookingAgg.gmv', 0] }, 0] },
          plan: { $ifNull: [{ $arrayElemAt: ['$subscription.plan', 0] }, 'free'] },
          subscriptionStatus: { $ifNull: [{ $arrayElemAt: ['$subscription.status', 0] }, 'active'] },
          totalPaid: { $ifNull: [{ $arrayElemAt: ['$subscription.totalPaid', 0] }, 0] },
          currentPeriodEnd: { $arrayElemAt: ['$subscription.currentPeriodEnd', 0] },
        },
      },
    ]),
    User.countDocuments(match),
  ]);

  const enriched = owners.map((o) => ({ ...o, planName: getPlan(o.plan).name }));
  return { owners: enriched, total, page, limit };
};

// ─── field moderation ─────────────────────────────────────────────────────────
const getFieldsForModeration = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.verified === 'true') filter.isVerified = true;
  if (query.verified === 'false') filter.isVerified = false;
  if (query.search) filter.$text = { $search: query.search };

  const [fields, total] = await Promise.all([
    Field.find(filter)
      .populate('owner', 'username fullName email avatar phone')
      .skip(skip).limit(limit).sort('-createdAt'),
    Field.countDocuments(filter),
  ]);
  return { fields, total, page, limit };
};

// ─── user moderation ──────────────────────────────────────────────────────────
/** Cập nhật quyền của user. Admin không được tự hạ quyền chính mình để tránh khoá cửa hệ thống. */
const updateUserRoles = async (userId, roles, actingAdminId) => {
  if (userId === actingAdminId && !roles.includes(Role.ADMIN)) {
    throw new AppError('You cannot remove your own admin role', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  // Gỡ quyền chủ sân khi vẫn còn sân đang hoạt động sẽ để lại sân không ai quản lý
  if (user.roles.includes(Role.FIELD_OWNER) && !roles.includes(Role.FIELD_OWNER)) {
    const owned = await Field.countDocuments({ owner: userId });
    if (owned > 0) {
      throw new AppError(
        `This user still owns ${owned} field(s). Transfer or delete them before removing the field owner role.`,
        HttpStatus.CONFLICT,
        ErrorCode.CONFLICT
      );
    }
  }

  const previousRoles = user.roles;
  user.roles = [...new Set(roles)];
  await user.save();

  if (user.roles.includes(Role.FIELD_OWNER)) {
    // Chủ sân mới cần có thuê bao để tính hạn mức và hoá đơn
    await billingService.ensureSubscription(user._id);
  }

  await adminAuditLogService.record(
    actingAdminId, AdminAction.USER_ROLES_UPDATED, AdminTargetType.USER, userId,
    { from: previousRoles, to: user.roles }
  );

  return user;
};

/** Cấm user kèm ràng buộc: không tự cấm chính mình. */
const updateUserStatus = async (userId, status, actingAdminId) => {
  if (userId === actingAdminId && status !== 'active') {
    throw new AppError('You cannot deactivate your own account', HttpStatus.BAD_REQUEST, ErrorCode.CONFLICT);
  }
  const previous = await User.findById(userId).select('status');
  if (!previous) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  const user = await User.findByIdAndUpdate(userId, { status }, { new: true, runValidators: true });

  await adminAuditLogService.record(
    actingAdminId, AdminAction.USER_STATUS_UPDATED, AdminTargetType.USER, userId,
    { from: previous.status, to: status }
  );

  return user;
};

// ─── getOwnerDetail ───────────────────────────────────────────────────────────
const getOwnerDetail = async (ownerId) => {
  const owner = await User.findById(ownerId);
  if (!owner) throw new AppError('Owner not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const [subscription, fields, invoices] = await Promise.all([
    Subscription.findOne({ owner: ownerObjectId }),
    Field.find({ owner: ownerObjectId }).select('name status isVerified rating totalBookings subFields location').lean(),
    Invoice.find({ owner: ownerObjectId }).sort('-createdAt').limit(20),
  ]);

  // Lọc theo danh sách sân đã có sẵn thay vì $lookup toàn bộ collection booking
  const fieldIds = fields.map((f) => f._id);
  const bookingAgg = fieldIds.length
    ? await Booking.aggregate([
      { $match: { field: { $in: fieldIds } } },
      { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$totalPrice' } } },
    ])
    : [];

  return {
    owner,
    subscription,
    plan: getPlan(subscription?.plan),
    fields,
    invoices,
    bookingsByStatus: Object.fromEntries(bookingAgg.map((b) => [b._id, { count: b.count, value: b.value }])),
  };
};

module.exports = {
  getPlatformOverview,
  getRevenueSeries,
  getOwners,
  getOwnerDetail,
  getFieldsForModeration,
  updateUserRoles,
  updateUserStatus,
};
