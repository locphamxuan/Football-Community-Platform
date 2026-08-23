const mongoose = require('mongoose');

const subFieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fieldType: { type: String, enum: ['5v5', '7v7', '11v11'], required: true },
    surface: { type: String, enum: ['natural_grass', 'artificial_grass', 'concrete'], default: 'artificial_grass' },
    capacity: { type: Number, required: true },
    status: { type: String, enum: ['available', 'maintenance', 'closed'], default: 'available' },
  },
  { _id: true }
);

const pricingSlotSchema = new mongoose.Schema(
  {
    morning: { type: Number, required: true, min: 0 },   // 06:00 – 12:00
    afternoon: { type: Number, required: true, min: 0 }, // 12:00 – 18:00
    evening: { type: Number, required: true, min: 0 },   // 18:00 – 23:00
  },
  { _id: false }
);

/** Ghi đè giá cho một khoảng ngày cụ thể (lễ/Tết, giá theo mùa) — thay hẳn weekday/weekend gốc. */
const priceOverrideSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    weekday: { type: pricingSlotSchema, required: true },
    weekend: { type: pricingSlotSchema, required: true },
  },
  { timestamps: true }
);

/** Mã khuyến mãi của chủ sân — có thể giới hạn theo khung giờ, khoảng ngày và số lượt dùng. */
const promotionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function valuePercentageCap(v) {
          return this.type !== 'percentage' || v <= 100;
        },
        message: 'Percentage promotion value must be between 0 and 100',
      },
    },
    // Rỗng = áp dụng cho toàn bộ khung giờ.
    slots: { type: [{ type: String, enum: ['morning', 'afternoon', 'evening'] }], default: [] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
    maxUses: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const fieldSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, unique: true, lowercase: true },
    description: { type: String, default: '' },
    images: { type: [String], default: [] },
    location: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      district: { type: String, required: true },
      ward: { type: String, default: '' },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] },
      },
    },
    subFields: { type: [subFieldSchema], default: [] },
    pricing: {
      weekday: { type: pricingSlotSchema, required: true },
      weekend: { type: pricingSlotSchema, required: true },
    },
    priceOverrides: { type: [priceOverrideSchema], default: [] },
    promotions: { type: [promotionSchema], default: [] },
    operatingHours: {
      open: { type: String, default: '06:00' },
      close: { type: String, default: '23:00' },
    },
    amenities: { type: [String], default: [] },
    rules: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending_approval'],
      default: 'pending_approval',
    },
    isVerified: { type: Boolean, default: false },
    /** Ghi chú của admin khi duyệt/từ chối sân — chủ sân đọc được để biết cần sửa gì. */
    moderationNote: { type: String, default: '' },
    moderatedAt: { type: Date },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    totalBookings: { type: Number, default: 0 },
    cancellationPolicy: { type: String, default: '' },
  },
  { timestamps: true }
);

fieldSchema.index({ 'location.coordinates': '2dsphere' });
fieldSchema.index({ owner: 1 });
fieldSchema.index({ 'location.city': 1, status: 1 });
fieldSchema.index({ 'rating.average': -1, status: 1 });
fieldSchema.index({ name: 'text', description: 'text' }, { weights: { name: 10, description: 5 } });
fieldSchema.index({ createdAt: -1 });

const Field = mongoose.model('Field', fieldSchema);
module.exports = Field;
