const mongoose = require('mongoose');

const familyInviteSchema = new mongoose.Schema({
  inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  inviteeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('FamilyInvite', familyInviteSchema);
