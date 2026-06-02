const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['manager', 'captain', 'player'], default: 'player' },
    position: { type: String, default: '' },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, unique: true, lowercase: true },
    logo: { type: String, default: '' },
    description: { type: String, default: '', maxlength: 1000 },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
    homeCity: { type: String, default: '' },
    homeDistrict: { type: String, default: '' },
    skillLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'professional'],
      default: 'beginner',
    },
    fieldSize: { type: String, enum: ['5v5', '7v7', '11v11'], default: '7v7' },
    maxMembers: { type: Number, default: 15, min: 5, max: 30 },
    isPublic: { type: Boolean, default: true },
    inviteCode: { type: String, unique: true, sparse: true },
    tags: { type: [String], default: [] },
    stats: {
      matchesPlayed: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      goalsScored: { type: Number, default: 0 },
      goalsConceded: { type: Number, default: 0 },
      eloRating: { type: Number, default: 1200 },
    },
    status: { type: String, enum: ['active', 'inactive', 'disbanded'], default: 'active' },
  },
  { timestamps: true }
);

teamSchema.index({ manager: 1 });
teamSchema.index({ 'members.user': 1 });
teamSchema.index({ homeCity: 1, skillLevel: 1 });
teamSchema.index({ 'stats.eloRating': -1 });
teamSchema.index({ name: 'text', description: 'text' }, { weights: { name: 10, description: 3 } });

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;
