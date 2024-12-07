const express = require('express');
const router = express.Router();
const Player = require('../models/Player');

// POST update click count and experience
router.post('/', async (req, res) => {
    const { walletAddress, clickCount } = req.body;

    try {
        let player = await Player.findOne({ walletAddress });
        if (!player) {
            player = new Player({ walletAddress, points: parseInt(clickCount), base: { stage: 1, experience: 0 } });
        } else {
            player.points += parseInt(clickCount); // Increase points
            player.base.experience += parseInt(clickCount); // Add to experience
        }

        // Check if player has leveled up
        const experienceToNextLevel = calculateExperienceToNextLevel(player.base.stage);
        if (player.base.experience >= experienceToNextLevel) {
            player.base.stage += 1; // Increment stage (level)
            player.base.experience = 0; // Reset experience after leveling up
        }

        player.rank = calculateRank(player.points); // Update rank based on points
        await player.save();

        res.json({
            success: true,
            points: player.points,
            rank: player.rank,
            level: player.base.stage,
            experience: player.base.experience,
            experienceToNextLevel: experienceToNextLevel
        });
    } catch (error) {
        console.error('Error updating player:', error);
        res.status(500).json({ message: error.message });
    }
});

// Helper function to calculate the experience required to level up
const calculateExperienceToNextLevel = (level) => {
    return 1000 * Math.pow(1.5, level - 1); // Progressive experience curve
};

// Rank calculation function
const calculateRank = (points) => {
    if (points >= 100000) return 'Godfather';
    if (points >= 50000) return 'Don';
    if (points >= 25000) return 'Underboss';
    if (points >= 10000) return 'Capo';
    if (points >= 5000) return 'Soldier';
    if (points >= 1000) return 'Associate';
    return 'Rookie';
};

module.exports = router;
