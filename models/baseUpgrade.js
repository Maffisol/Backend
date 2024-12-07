// models/baseUpgrade.js
const mongoose = require('mongoose');

const baseUpgradeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['car', 'weapon', 'house', 'bullet', 'pool', 'villa', 'luxury'], 
        required: true 
    },
    cost: { type: Number, required: true },
    description: { type: String, required: true },
    benefits: { 
        strengthBoost: { type: Number, default: 0 },
        speedBoost: { type: Number, default: 0 }
    }
}, { collection: 'baseupgrades' });

const BaseUpgrade = mongoose.models.BaseUpgrade || mongoose.model('BaseUpgrade', baseUpgradeSchema);
module.exports = BaseUpgrade;
