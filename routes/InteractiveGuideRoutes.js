const express = require('express');
const router = express.Router();
const Player = require('../models/Player'); // Zorg ervoor dat je model correct is geïmporteerd

// Handle the update via Socket.IO in plaats van een HTTP route
module.exports = (io) => {
router.post('/update-guide-status', async (req, res) => {
    const { userId, hasSeenGuide } = req.body;
    
    try {
        // Zoek de speler op basis van 'userId' en werk de 'hasSeenGuide' status bij
        const user = await Player.findByIdAndUpdate(userId, { hasSeenGuide }, { new: true });

        // Verstuur de bijgewerkte spelerstatus via Socket.IO naar de frontend (als je dit wenst)
        req.app.get('io').emit('guideStatusUpdated', { userId, hasSeenGuide });

        res.status(200).json(user); // Stuur de bijgewerkte speler terug als reactie
    } catch (error) {
        res.status(500).json({ message: 'Error updating guide status', error });
    }
});
    
    

return router; // Zorg ervoor dat je de router retourneert
};
