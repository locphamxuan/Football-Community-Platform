const mongoose = require('mongoose');
const User = require('../../models/User');
const Field = require('../../models/Field');
const Booking = require('../../models/Booking');
const Subscription = require('../../models/Subscription');
const Invoice = require('../../models/Invoice');
const { getPagination } = require('../../utils/pagination');
const { getPlan } = require('../../constants/plans');
const Role = require('../../constants/roles');
const { AppError } = require('../../middleware/errorHandler');
const HttpStatus = require('../../constants/httpStatus');
const ErrorCode = require('../../constants/errorCodes');

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

module.exports = { getOwners, getOwnerDetail };
