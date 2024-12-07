const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema({
    title: { type: String, required: true }, // Name of the mission
    description: { type: String }, // Description of the mission
    reward: { type: Number, default: 0 }, // Reward for completing the mission
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' }, // Difficulty level
    createdAt: { type: Date, default: Date.now } // Date of mission creation
});

const Mission = mongoose.models.Mission || mongoose.model('Mission', missionSchema);

module.exports = Mission;
