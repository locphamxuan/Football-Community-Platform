const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
    subField: { type: mongoose.Schema.Types.ObjectId, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // "18:00"
    endTime: { type: String, required: true },   // "20:00"
    duration: { type: Number, required: true, min: 0.5 }, // giờ
    totalPrice: { type: Number, required: true, min: 0 },
    basePrice: { type: Number, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    promoCode: { type: String },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'online'],
      default: 'cash',
    },
    notes: { type: String, default: '' },
    cancelReason: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

bookingSchema.index({ field: 1, date: 1, status: 1 });
bookingSchema.index({ user: 1, status: 1, createdAt: -1 });
bookingSchema.index({ subField: 1, date: 1, startTime: 1, endTime: 1, status: 1 });
bookingSchema.index({ team: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
