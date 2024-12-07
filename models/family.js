const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    owner: { type: String, required: true, trim: true },
    members: [{ type: String, required: true, trim: true }],
    resources: { type: Number, default: 0, min: 0 }, // Resources cannot be negative
    money: { type: Number, default: 0, min: 0 }, // Family money field added
    upgrades: {
        armory: { type: Number, default: 0, min: 0 }, // Minimum value is 0
        defense: { type: Number, default: 0, min: 0 },
        income: { type: Number, default: 0, min: 0 },
    },
    sabotageLog: [
        {
            attacker: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' },
            action: { type: String, enum: ['sabotage', 'defense'], required: true },
            timestamp: { type: Date, default: Date.now },
        },
    ],
    dominancePoints: { type: Number, required: true, default: 0, min: 0 }, // Added dominance points
    effects: {
        defenseBoost: { type: Number, default: 0 }, // Additional boost effects for upgrades
        sabotageResistance: { type: Number, default: 0 },
        incomeBoost: { type: Number, default: 0 },
    },
    chatHistory: [
        {
            sender: { type: String, required: true }, // Sender's username or ID
            message: { type: String, required: true }, // Chat message content
            timestamp: { type: Date, default: Date.now }, // Timestamp of the message
        },
    ],
    cooldowns: {
        claim: { type: Date, default: null }, // Timestamp for claim cooldown
        sabotage: { type: Date, default: null }, // Timestamp for sabotage cooldown
        collect: { type: Date, default: null }, // Timestamp for collect cooldown
        upgrade: { type: Date, default: null }, // Timestamp for upgrade cooldown
    },
    winningCondition: {
        superTerritory: { type: Boolean, default: false },
        winDate: { type: Date, default: null },
    },
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

module.exports = mongoose.model('Family', familySchema);
