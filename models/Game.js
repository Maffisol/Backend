// models/Game.js
const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    walletAddress: { type: String, required: true },
    gameType: { type: String, required: true }, // e.g., "Lockpicking", "Shootout"
    score: { type: Number, required: true },
    reward: {
        xp: { type: Number, default: 0 },
        money: { type: Number, default: 0 },
        item: { type: String, default: null } // Optional, for special items
    },
    datePlayed: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);
