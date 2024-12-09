const express = require('express');
const router = express.Router();
const Player = require('../models/Player');

// Route: Attempt smuggling
router.post('/smuggling', async (req, res) => {
    const { walletAddress } = req.body;

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) return res.status(404).json({ message: 'Player not found' });

        const success = Math.random() < 0.5;
        if (success) {
            const reward = 700;
            player.money += reward;
            await player.save();
            return res.status(200).json({ success: true, reward, message: 'Successfully smuggled goods!' });
        } else {
            await sendPlayerToJail(player);
            return res.status(200).json({ success: false, message: 'Smuggling failed, you are now in jail!' });
        }
    } catch (error) {
        console.error('Error in smuggling route:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Route: Attempt to steal a car
router.post('/steal-car', async (req, res) => {
    const { walletAddress } = req.body;

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) return res.status(404).json({ message: 'Player not found' });

        const success = Math.random() < 0.4;
        if (success) {
            const reward = 1200;
            player.money += reward;
            await player.save();
            return res.status(200).json({ success: true, reward, message: 'Successfully stole a car!' });
        } else {
            await sendPlayerToJail(player);
            return res.status(200).json({ success: false, message: 'Failed to steal car, you are now in jail!' });
        }
    } catch (error) {
        console.error('Error in steal car route:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Route: Attempt crimes
router.post('/crimes', async (req, res) => {
    const { walletAddress } = req.body;

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) return res.status(404).json({ message: 'Player not found' });

        const success = Math.random() < 0.3;
        if (success) {
            const reward = 1000;
            player.money += reward;
            await player.save();
            return res.status(200).json({ success: true, reward, message: 'Crime successful!' });
        } else {
            await sendPlayerToJail(player);
            return res.status(200).json({ success: false, message: 'Crime failed, you are now in jail!' });
        }
    } catch (error) {
        console.error('Error in crimes route:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
