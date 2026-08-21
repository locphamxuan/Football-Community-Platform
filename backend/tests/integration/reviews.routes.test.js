jest.mock('../../src/config/redis', () => require('../helpers/fakeRedis'));
jest.mock('../../src/services/review.service');

const request = require('supertest');
const app = require('../../src/app');
const reviewService = require('../../src/services/review.service');
const { asUser, asOwner, asAdmin, USER_ID } = require('../helpers/auth');

const REVIEW_ID = '000000000000000000000050';
const FIELD_ID = '000000000000000000000010';

const emptyPage = { reviews: [], total: 0, page: 1, limit: 10 };

describe('GET /api/v1/reviews/field/:fieldId', () => {
  it('công khai, không cần đăng nhập', async () => {
    reviewService.getFieldReviews.mockResolvedValue(emptyPage);

    const res = await request(app).get(`/api/v1/reviews/field/${FIELD_ID}`);

    expect(res.status).toBe(200);
    expect(reviewService.getFieldReviews).toHaveBeenCalledWith(FIELD_ID, expect.any(Object));
  });
});

describe('các endpoint cần đăng nhập', () => {
  it.each([
    ['get', '/api/v1/reviews/me'],
    ['get', '/api/v1/reviews/owner/reviews'],
    ['post', '/api/v1/reviews'],
    ['patch', `/api/v1/reviews/${REVIEW_ID}`],
    ['delete', `/api/v1/reviews/${REVIEW_ID}`],
    ['post', `/api/v1/reviews/${REVIEW_ID}/like`],
    ['post', `/api/v1/reviews/${REVIEW_ID}/reply`],
  ])('%s %s trả 401 khi thiếu token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/reviews', () => {
  it('ép rating dạng chuỗi của multipart về số', async () => {
    reviewService.createReview.mockResolvedValue({ _id: REVIEW_ID });

    const res = await request(app)
      .post('/api/v1/reviews')
      .set(asUser())
      .field('fieldId', FIELD_ID)
      .field('rating', '5')
      .field('comment', 'Sân đẹp');

    expect(res.status).toBe(201);
    expect(reviewService.createReview).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ fieldId: FIELD_ID, rating: 5, comment: 'Sân đẹp' }),
      []
    );
  });

  it.each([
    ['rating vượt 5', { fieldId: FIELD_ID, rating: '6' }],
    ['rating bằng 0', { fieldId: FIELD_ID, rating: '0' }],
    ['rating không phải số', { fieldId: FIELD_ID, rating: 'tuyệt vời' }],
    ['thiếu fieldId', { rating: '4' }],
  ])('từ chối khi %s', async (_label, fields) => {
    let req = request(app).post('/api/v1/reviews').set(asUser());
    Object.entries(fields).forEach(([key, value]) => { req = req.field(key, value); });

    const res = await req;

    expect(res.status).toBe(400);
    expect(reviewService.createReview).not.toHaveBeenCalled();
  });

  it('kèm ảnh thì file được chuyển xuống service', async () => {
    reviewService.createReview.mockResolvedValue({ _id: REVIEW_ID });

    await request(app)
      .post('/api/v1/reviews')
      .set(asUser())
      .field('fieldId', FIELD_ID)
      .field('rating', '4')
      .attach('images', Buffer.from('fake-jpg'), { filename: 'san.jpg', contentType: 'image/jpeg' });

    expect(reviewService.createReview).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Object),
      [expect.objectContaining({ originalname: 'san.jpg' })]
    );
  });
});

describe('sửa, xoá và thích đánh giá', () => {
  it('sửa đánh giá', async () => {
    reviewService.updateReview.mockResolvedValue({ _id: REVIEW_ID, rating: 3 });

    const res = await request(app)
      .patch(`/api/v1/reviews/${REVIEW_ID}`)
      .set(asUser())
      .send({ rating: 3, comment: 'Sửa lại' });

    expect(res.status).toBe(200);
    expect(reviewService.updateReview).toHaveBeenCalledWith(REVIEW_ID, USER_ID, { rating: 3, comment: 'Sửa lại' });
  });

  it('rating ngoài khoảng 1-5 thì bị từ chối', async () => {
    const res = await request(app)
      .patch(`/api/v1/reviews/${REVIEW_ID}`)
      .set(asUser())
      .send({ rating: 6 });

    expect(res.status).toBe(400);
    expect(reviewService.updateReview).not.toHaveBeenCalled();
  });

  it('người viết xoá đánh giá của mình', async () => {
    reviewService.deleteReview.mockResolvedValue(undefined);

    const res = await request(app).delete(`/api/v1/reviews/${REVIEW_ID}`).set(asUser());

    expect(res.status).toBe(200);
    expect(reviewService.deleteReview).toHaveBeenCalledWith(REVIEW_ID, USER_ID, false);
  });

  it('admin xoá đánh giá thì service nhận cờ isAdmin', async () => {
    reviewService.deleteReview.mockResolvedValue(undefined);

    await request(app).delete(`/api/v1/reviews/${REVIEW_ID}`).set(asAdmin());

    expect(reviewService.deleteReview).toHaveBeenCalledWith(REVIEW_ID, USER_ID, true);
  });

  it('bật/tắt lượt thích', async () => {
    reviewService.toggleLike.mockResolvedValue({ liked: true, likeCount: 1 });

    const res = await request(app).post(`/api/v1/reviews/${REVIEW_ID}/like`).set(asUser());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ liked: true, likeCount: 1 });
  });
});

describe('chủ sân trả lời đánh giá', () => {
  it('trả lời có nội dung', async () => {
    reviewService.ownerReply.mockResolvedValue({ _id: REVIEW_ID });

    const res = await request(app)
      .post(`/api/v1/reviews/${REVIEW_ID}/reply`)
      .set(asOwner())
      .send({ comment: 'Cảm ơn bạn' });

    expect(res.status).toBe(200);
    expect(reviewService.ownerReply).toHaveBeenCalledWith(REVIEW_ID, USER_ID, 'Cảm ơn bạn');
  });

  it('trả lời rỗng bị từ chối', async () => {
    const res = await request(app).post(`/api/v1/reviews/${REVIEW_ID}/reply`).set(asOwner()).send({ comment: '' });

    expect(res.status).toBe(400);
    expect(reviewService.ownerReply).not.toHaveBeenCalled();
  });

  it('hộp thư đánh giá chỉ dành cho chủ sân', async () => {
    const res = await request(app).get('/api/v1/reviews/owner/reviews').set(asUser());

    expect(res.status).toBe(403);
  });

  it('hộp thư trả kèm số đánh giá chưa trả lời', async () => {
    reviewService.getOwnerReviews.mockResolvedValue({ ...emptyPage, unanswered: 4 });

    const res = await request(app).get('/api/v1/reviews/owner/reviews').set(asOwner());

    expect(res.status).toBe(200);
    expect(res.body.data.unanswered).toBe(4);
  });
});

describe('GET /api/v1/reviews/me', () => {
  it('không bị route /:id nuốt mất', async () => {
    reviewService.getMyReviews.mockResolvedValue(emptyPage);

    const res = await request(app).get('/api/v1/reviews/me').set(asUser());

    expect(res.status).toBe(200);
    expect(reviewService.getMyReviews).toHaveBeenCalledWith(USER_ID, expect.any(Object));
  });
});
