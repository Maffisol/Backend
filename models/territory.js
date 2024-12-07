const mongoose = require('mongoose');

const TerritorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    bonus: { type: String, required: true },
    resourceIncome: { type: Number, default: 0 },
    controlledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', default: null },
    status: { type: String, enum: ['free', 'controlled'], default: 'free' },
    seasonal: { type: Boolean, default: false },
    eventExclusive: { type: Boolean, default: false },
    dominancePoints: { type: Number, default: 10 }, // Dominantiepunten
});

module.exports = mongoose.model('Territory', TerritorySchema);
