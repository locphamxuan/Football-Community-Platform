const reviewService = require('../services/review.service');
const { sendSuccess, paginationMeta } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');
const HttpStatus = require('../constants/httpStatus');

const getFieldReviews = catchAsync(async (req, res) => {
  const { reviews, total, page, limit } = await reviewService.getFieldReviews(req.params.fieldId, req.query);
  sendSuccess(res, { reviews }, 'Reviews retrieved', HttpStatus.OK, { pagination: paginationMeta(total, page, limit) });
});

const createReview = catchAsync(async (req, res) => {
  const files = req.files || [];
  const review = await reviewService.createReview(req.user.id, req.body, files);
  sendSuccess(res, { review }, 'Review created', HttpStatus.CREATED);
});

const updateReview = catchAsync(async (req, res) => {
  const review = await reviewService.updateReview(req.params.id, req.user.id, req.body);
  sendSuccess(res, { review }, 'Review updated');
});

const deleteReview = catchAsync(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  await reviewService.deleteReview(req.params.id, req.user.id, isAdmin);
  sendSuccess(res, null, 'Review deleted');
});

const toggleLike = catchAsync(async (req, res) => {
  const result = await reviewService.toggleLike(req.params.id, req.user.id);
  sendSuccess(res, result);
});

const ownerReply = catchAsync(async (req, res) => {
  const review = await reviewService.ownerReply(req.params.id, req.user.id, req.body.comment);
  sendSuccess(res, { review }, 'Reply added');
});

const getMyReviews = catchAsync(async (req, res) => {
  const { reviews, total, page, limit } = await reviewService.getMyReviews(req.user.id, req.query);
  sendSuccess(res, { reviews }, 'Reviews retrieved', HttpStatus.OK, { pagination: paginationMeta(total, page, limit) });
});

const getOwnerReviews = catchAsync(async (req, res) => {
  const { reviews, total, page, limit, unanswered } = await reviewService.getOwnerReviews(req.user.id, req.query);
  sendSuccess(res, { reviews, unanswered }, 'Reviews retrieved', HttpStatus.OK, {
    pagination: paginationMeta(total, page, limit),
  });
});

module.exports = {
  getFieldReviews, createReview, updateReview, deleteReview,
  toggleLike, ownerReply, getMyReviews, getOwnerReviews,
};
