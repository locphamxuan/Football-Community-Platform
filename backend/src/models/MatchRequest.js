const mongoose = require('mongoose');

const matchRequestSchema = new mongoose.Schema(
  {
    requesterTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    opponentTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    fieldSize: { type: String, enum: ['5v5', '7v7', '11v11'], required: true },
    message: { type: String, default: '', maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
    result: {
      requesterScore: { type: Number, default: 0, min: 0 },
      opponentScore: { type: Number, default: 0, min: 0 },
      winner: { type: String, enum: ['requester', 'opponent', 'draw'] },
      confirmedByRequester: { type: Boolean, default: false },
      confirmedByOpponent: { type: Boolean, default: false },
    },
    eloChange: {
      requester: { type: Number, default: 0 },
      opponent: { type: Number, default: 0 },
    },
    respondedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

matchRequestSchema.index({ requesterTeam: 1, status: 1 });
matchRequestSchema.index({ opponentTeam: 1, status: 1 });
matchRequestSchema.index({ date: 1 });
matchRequestSchema.index({ requestedBy: 1 });

const MatchRequest = mongoose.model('MatchRequest', matchRequestSchema);
module.exports = MatchRequest;
