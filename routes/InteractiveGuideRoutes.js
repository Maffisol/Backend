const express = require('express');
const router = express.Router();
const Player = require('../models/Player'); // Gebruik Player model

// Route om de 'hasSeenGuide' status bij te werken
router.post('/update-guide-status', async (req, res) => {
    const { userId, hasSeenGuide } = req.body;
    try {
        // Zoek de speler op basis van 'userId' en werk 'hasSeenGuide' bij
        const user = await Player.findByIdAndUpdate(userId, { hasSeenGuide }, { new: true });
        res.status(200).json(user); // Stuur de bijgewerkte speler terug als reactie
    } catch (error) {
        res.status(500).json({ message: 'Error updating guide status', error });
    }
});

module.exports = router;
