jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/models/Review', () => ({
  findById: jest.fn(), findOne: jest.fn(), find: jest.fn(),
  findByIdAndUpdate: jest.fn(), create: jest.fn(),
  countDocuments: jest.fn(), aggregate: jest.fn(),
}));
jest.mock('../../src/models/Field', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../../src/models/Booking', () => ({ findOne: jest.fn() }));
jest.mock('../../src/config/cloudinary', () => ({
  uploadMultipleImages: jest.fn().mockResolvedValue([{ url: 'https://cdn/anh.jpg' }]),
}));

const Review = require('../../src/models/Review');
const Field = require('../../src/models/Field');
const Booking = require('../../src/models/Booking');
const { uploadMultipleImages } = require('../../src/config/cloudinary');
const reviewService = require('../../src/services/review.service');

const USER_ID = '000000000000000000000001';
const OWNER_ID = '000000000000000000000002';
const FIELD_ID = '000000000000000000000010';
const BOOKING_ID = '000000000000000000000020';
const REVIEW_ID = '000000000000000000000030';

const completedBooking = () => ({ _id: BOOKING_ID, sort: undefined });

/** Booking.findOne(...).sort('-date') */
const bookingFound = (value) => Booking.findOne.mockReturnValue({ sort: () => Promise.resolve(value) });

const populated = (value) => ({ populate: () => Promise.resolve(value) });

const fakeReview = (overrides = {}) => ({
  _id: REVIEW_ID,
  field: FIELD_ID,
  user: { toString: () => USER_ID },
  rating: 4,
  likes: [],
  deleteOne: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  Review.aggregate.mockResolvedValue([{ avg: 4.25, count: 4 }]);
  Review.findByIdAndUpdate.mockReturnValue(populated({ _id: REVIEW_ID }));
  Field.findByIdAndUpdate.mockResolvedValue({});
});

describe('createReview', () => {
  beforeEach(() => {
    Field.findById.mockResolvedValue({ _id: FIELD_ID });
    Review.findOne.mockResolvedValue(null);
    bookingFound(completedBooking());
    Review.create.mockResolvedValue({ _id: REVIEW_ID, field: FIELD_ID });
    Review.findById.mockReturnValue(populated({ _id: REVIEW_ID }));
  });

  it('người đã đá xong ở sân thì đánh giá được', async () => {
    await expect(reviewService.createReview(USER_ID, { fieldId: FIELD_ID, rating: 5 })).resolves.toBeDefined();
    expect(Review.create).toHaveBeenCalledWith(expect.objectContaining({
      field: FIELD_ID, user: USER_ID, rating: 5, booking: BOOKING_ID, isVerified: true,
    }));
  });

  it('chưa từng đá ở sân thì không đánh giá được — nếu không điểm sân là con số vô nghĩa', async () => {
    bookingFound(null);

    await expect(reviewService.createReview(USER_ID, { fieldId: FIELD_ID, rating: 5 }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(Review.create).not.toHaveBeenCalled();
  });

  it('chỉ tính các lượt đặt đã hoàn thành', async () => {
    await reviewService.createReview(USER_ID, { fieldId: FIELD_ID, rating: 5 });

    expect(Booking.findOne).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('mỗi người chỉ đánh giá một sân một lần', async () => {
    Review.findOne.mockResolvedValue({ _id: 'da-co' });

    await expect(reviewService.createReview(USER_ID, { fieldId: FIELD_ID, rating: 5 }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('sân không tồn tại trả 404', async () => {
    Field.findById.mockResolvedValue(null);

    await expect(reviewService.createReview(USER_ID, { fieldId: FIELD_ID, rating: 5 }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('có ảnh thì upload rồi lưu URL', async () => {
    await reviewService.createReview(USER_ID, { fieldId: FIELD_ID, rating: 5 }, [{ buffer: Buffer.from('x') }]);

    expect(uploadMultipleImages).toHaveBeenCalled();
    expect(Review.create).toHaveBeenCalledWith(expect.objectContaining({ images: ['https://cdn/anh.jpg'] }));
  });

  it('không có ảnh thì không gọi Cloudinary', async () => {
    await reviewService.createReview(USER_ID, { fieldId: FIELD_ID, rating: 5 });

    expect(uploadMultipleImages).not.toHaveBeenCalled();
  });

  it('tính lại điểm trung bình của sân sau khi thêm đánh giá', async () => {
    await reviewService.createReview(USER_ID, { fieldId: FIELD_ID, rating: 5 });

    expect(Field.findByIdAndUpdate).toHaveBeenCalledWith(
      FIELD_ID, { 'rating.average': 4.3, 'rating.count': 4 }
    );
  });
});

describe('updateReview và deleteReview', () => {
  it('chỉ người viết mới sửa được', async () => {
    Review.findById.mockResolvedValue(fakeReview());

    await expect(reviewService.updateReview(REVIEW_ID, 'nguoi-khac', { rating: 1 }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('sửa xong thì tính lại điểm sân', async () => {
    Review.findById.mockResolvedValue(fakeReview());

    await reviewService.updateReview(REVIEW_ID, USER_ID, { rating: 1 });

    expect(Field.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('người viết xoá được đánh giá của mình', async () => {
    const review = fakeReview();
    Review.findById.mockResolvedValue(review);

    await reviewService.deleteReview(REVIEW_ID, USER_ID);

    expect(review.deleteOne).toHaveBeenCalled();
  });

  it('admin xoá được đánh giá của người khác', async () => {
    const review = fakeReview();
    Review.findById.mockResolvedValue(review);

    await reviewService.deleteReview(REVIEW_ID, 'admin-khac', true);

    expect(review.deleteOne).toHaveBeenCalled();
  });

  it('người lạ không xoá được', async () => {
    Review.findById.mockResolvedValue(fakeReview());

    await expect(reviewService.deleteReview(REVIEW_ID, 'nguoi-la'))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('không còn đánh giá nào thì điểm sân về 0', async () => {
    Review.findById.mockResolvedValue(fakeReview());
    Review.aggregate.mockResolvedValue([]);

    await reviewService.deleteReview(REVIEW_ID, USER_ID);

    expect(Field.findByIdAndUpdate).toHaveBeenCalledWith(
      FIELD_ID, { 'rating.average': 0, 'rating.count': 0 }
    );
  });
});

describe('toggleLike', () => {
  it('lần đầu là thích', async () => {
    Review.findById.mockResolvedValue(fakeReview());
    Review.findByIdAndUpdate.mockResolvedValue({});

    const result = await reviewService.toggleLike(REVIEW_ID, USER_ID);

    expect(result.liked).toBe(true);
    expect(Review.findByIdAndUpdate).toHaveBeenCalledWith(REVIEW_ID, { $addToSet: { likes: USER_ID } });
  });

  it('bấm lại là bỏ thích', async () => {
    Review.findById.mockResolvedValue(fakeReview({ likes: [{ toString: () => USER_ID }] }));
    Review.findByIdAndUpdate.mockResolvedValue({});

    const result = await reviewService.toggleLike(REVIEW_ID, USER_ID);

    expect(result.liked).toBe(false);
    expect(Review.findByIdAndUpdate).toHaveBeenCalledWith(REVIEW_ID, { $pull: { likes: USER_ID } });
  });
});

describe('ownerReply', () => {
  it('chủ sân trả lời được đánh giá trên sân của mình', async () => {
    Review.findById.mockReturnValue(populated(fakeReview({ field: { owner: { toString: () => OWNER_ID } } })));

    await reviewService.ownerReply(REVIEW_ID, OWNER_ID, 'Cảm ơn bạn');

    expect(Review.findByIdAndUpdate).toHaveBeenCalledWith(
      REVIEW_ID,
      expect.objectContaining({ 'ownerReply.comment': 'Cảm ơn bạn' }),
      { new: true }
    );
  });

  it('chủ sân khác không trả lời hộ được', async () => {
    Review.findById.mockReturnValue(populated(fakeReview({ field: { owner: { toString: () => OWNER_ID } } })));

    await expect(reviewService.ownerReply(REVIEW_ID, 'chu-san-khac', 'Xin chào'))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});
