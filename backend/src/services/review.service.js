const Review = require('../models/Review');
const Field = require('../models/Field');
const Booking = require('../models/Booking');
const { uploadMultipleImages } = require('../config/cloudinary');
const { getPagination } = require('../utils/pagination');
const { cache, CacheKeys } = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');
const HttpStatus = require('../constants/httpStatus');
const ErrorCode = require('../constants/errorCodes');

// Cập nhật lại rating trung bình của Field sau khi review thay đổi
const recalculateFieldRating = async (fieldId) => {
  const result = await Review.aggregate([
    { $match: { field: fieldId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const avg = result[0] ? Math.round(result[0].avg * 10) / 10 : 0;
  const count = result[0] ? result[0].count : 0;

  await Field.findByIdAndUpdate(fieldId, { 'rating.average': avg, 'rating.count': count });
  await cache.del(CacheKeys.field(fieldId.toString()));
};

// ─── getFieldReviews ──────────────────────────────────────────────────────────
const getFieldReviews = async (fieldId, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { field: fieldId };
  if (query.rating) filter.rating = Number(query.rating);

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('user', 'username fullName avatar')
      .skip(skip).limit(limit).sort('-createdAt'),
    Review.countDocuments(filter),
  ]);
  return { reviews, total, page, limit };
};

// ─── createReview ─────────────────────────────────────────────────────────────
const createReview = async (userId, data, files = []) => {
  const field = await Field.findById(data.fieldId);
  if (!field) throw new AppError('Field not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  const existing = await Review.findOne({ field: data.fieldId, user: userId });
  if (existing) throw new AppError('You have already reviewed this field', HttpStatus.CONFLICT, ErrorCode.CONFLICT);

  // Chỉ người thực sự đã đá ở sân mới được đánh giá — nếu không, rating sân là con số vô nghĩa
  const bookingFilter = {
    user: userId,
    field: data.fieldId,
    status: 'completed',
  };
  if (data.bookingId) bookingFilter._id = data.bookingId;

  const booking = await Booking.findOne(bookingFilter).sort('-date');
  if (!booking) {
    throw new AppError(
      'You can only review a field after completing a booking there',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN
    );
  }

  let images = [];
  if (files.length > 0) {
    const uploaded = await uploadMultipleImages(files, 'reviews');
    images = uploaded.map((u) => u.url);
  }

  const review = await Review.create({
    field: data.fieldId,
    user: userId,
    booking: booking._id,
    rating: data.rating,
    comment: data.comment || '',
    images,
    isVerified: true,
  });

  await recalculateFieldRating(review.field);

  return Review.findById(review._id).populate('user', 'username fullName avatar');
};

// ─── updateReview ─────────────────────────────────────────────────────────────
const updateReview = async (reviewId, userId, data) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError('Review not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (review.user.toString() !== userId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  const updated = await Review.findByIdAndUpdate(reviewId, data, { new: true })
    .populate('user', 'username fullName avatar');

  await recalculateFieldRating(review.field);
  return updated;
};

// ─── deleteReview ─────────────────────────────────────────────────────────────
const deleteReview = async (reviewId, userId, isAdmin = false) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError('Review not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (!isAdmin && review.user.toString() !== userId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  const fieldId = review.field;
  await review.deleteOne();
  await recalculateFieldRating(fieldId);
};

// ─── toggleLike ───────────────────────────────────────────────────────────────
const toggleLike = async (reviewId, userId) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError('Review not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);

  const liked = review.likes.some((id) => id.toString() === userId);
  if (liked) {
    await Review.findByIdAndUpdate(reviewId, { $pull: { likes: userId } });
  } else {
    await Review.findByIdAndUpdate(reviewId, { $addToSet: { likes: userId } });
  }

  return { liked: !liked };
};

// ─── ownerReply ───────────────────────────────────────────────────────────────
const ownerReply = async (reviewId, userId, comment) => {
  const review = await Review.findById(reviewId).populate('field');
  if (!review) throw new AppError('Review not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  if (review.field.owner.toString() !== userId) throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);

  return Review.findByIdAndUpdate(
    reviewId,
    { 'ownerReply.comment': comment, 'ownerReply.repliedAt': new Date() },
    { new: true }
  ).populate('user', 'username fullName avatar');
};

// ─── getMyReviews ─────────────────────────────────────────────────────────────
const getMyReviews = async (userId, query) => {
  const { page, limit, skip } = getPagination(query);
  const [reviews, total] = await Promise.all([
    Review.find({ user: userId })
      .populate('field', 'name location images slug')
      .skip(skip).limit(limit).sort('-createdAt'),
    Review.countDocuments({ user: userId }),
  ]);
  return { reviews, total, page, limit };
};

// ─── getOwnerReviews ──────────────────────────────────────────────────────────
/** Mọi đánh giá trên các sân của chủ sân, để chủ sân theo dõi và phản hồi. */
const getOwnerReviews = async (ownerId, query) => {
  const { page, limit, skip } = getPagination(query);

  const fieldIds = await Field.find({ owner: ownerId }).distinct('_id');
  if (fieldIds.length === 0) return { reviews: [], total: 0, page, limit, unanswered: 0 };

  const filter = { field: { $in: fieldIds } };
  if (query.fieldId) filter.field = query.fieldId;
  if (query.rating) filter.rating = Number(query.rating);
  if (query.unanswered === 'true') filter['ownerReply.repliedAt'] = { $exists: false };

  const [reviews, total, unanswered] = await Promise.all([
    Review.find(filter)
      .populate('user', 'username fullName avatar')
      .populate('field', 'name location')
      .skip(skip).limit(limit).sort('-createdAt'),
    Review.countDocuments(filter),
    Review.countDocuments({ field: { $in: fieldIds }, 'ownerReply.repliedAt': { $exists: false } }),
  ]);
  return { reviews, total, page, limit, unanswered };
};

module.exports = {
  getFieldReviews, createReview, updateReview, deleteReview,
  toggleLike, ownerReply, getMyReviews, getOwnerReviews,
};
