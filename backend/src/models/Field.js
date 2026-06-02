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
