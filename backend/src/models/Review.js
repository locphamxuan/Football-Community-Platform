const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 1000 },
    images: { type: [String], default: [] },
    likes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    ownerReply: {
      comment: { type: String, default: '' },
      repliedAt: { type: Date },
    },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Một user chỉ được review một lần cho mỗi field
reviewSchema.index({ field: 1, user: 1 }, { unique: true });
reviewSchema.index({ field: 1, createdAt: -1 });
reviewSchema.index({ user: 1 });

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
