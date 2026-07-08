const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    deviceInfo: { type: String, default: 'Unknown' },
    ipAddress: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    fullName: { type: String, required: true, trim: true },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    location: {
      city: { type: String, default: '' },
      district: { type: String, default: '' },
      coordinates: {
        type: { type: String, enum: ['Point'] },
        coordinates: [Number],
      },
    },
    roles: {
      type: [String],
      enum: ['user', 'team_manager', 'field_owner', 'admin'],
      default: ['user'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active',
    },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
    playerProfile: {
      positions: { type: [String], default: [] },
      skillLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'professional'],
        default: 'beginner',
      },
      bio: { type: String, default: '' },
      stats: {
        matchesPlayed: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        goalsScored: { type: Number, default: 0 },
        assists: { type: Number, default: 0 },
        eloRating: { type: Number, default: 1200 },
      },
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },
    lastSeen: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        return ret;
      },
    },
  }
);

userSchema.index({ 'location.coordinates': '2dsphere' });
userSchema.index({ roles: 1, status: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
