const mongoose = require('mongoose');

const HitterSchema = new mongoose.Schema({
    walletAddress: { type: String, required: true, unique: true },
    clickCount: { type: Number, default: 0 },
});

// Change 'Click' to 'Hitter'
module.exports = mongoose.model('Hitter', HitterSchema);
