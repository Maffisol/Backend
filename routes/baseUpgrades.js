const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const BaseUpgrade = require('../models/baseUpgrade');



module.exports = (io) => {
// Route to get all available upgrades
router.get('/all', async (req, res) => {
    try {
        const upgrades = await BaseUpgrade.find({});
        res.json(upgrades);
    } catch (err) {
        console.error('Error fetching upgrades:', err);
        res.status(500).json({ message: 'Error fetching upgrades' });
    }
});

// Adjusted purchase route to use walletAddress
router.post('/purchase', async (req, res) => {
    const { walletAddress, upgradeId } = req.body;
    console.log('Received purchase request:', { walletAddress, upgradeId });

    try {
        const player = await Player.findOne({ walletAddress }).populate('upgrades.upgradeId');
        const upgrade = await BaseUpgrade.findById(upgradeId);

        if (!player || !upgrade) {
            return res.status(404).json({ message: 'Player or Upgrade not found.' });
        }

        const hasUpgrade = player.upgrades.some((p) => p.upgradeId._id.equals(upgrade._id));
        if (hasUpgrade) {
            return res.status(400).json({ message: 'Upgrade already purchased.' });
        }

        if (player.money < upgrade.cost) {
            return res.status(400).json({ message: 'Not enough money to purchase upgrade.' });
        }

        // Deduct money and add the upgrade
        player.money -= upgrade.cost;
        player.upgrades.push({ upgradeId: upgrade._id, purchasedAt: new Date() });
        player.points += 100;

        await player.save();

        // Reload the updated player profile
        const updatedPlayer = await Player.findOne({ walletAddress }).populate('upgrades.upgradeId');

        // Emit real-time update
        io.to(walletAddress).emit('playerUpdated', {
            walletAddress,
            updatedPlayer,
        });

        res.json({ message: 'Upgrade purchased successfully!', player: updatedPlayer });
    } catch (err) {
        console.error('Error purchasing upgrade:', err);
        res.status(500).json({ message: 'Error purchasing upgrade', error: err });
    }
});


return router;
};