const express = require('express');
const Player = require('../models/Player');
const {
    calculateSuccessChance,
    transferMoney,
    transferItem,
    loseMoney,
    sendToJail,
    setCooldown,
} = require('../helpers/killHelpers');

module.exports = (io) => {
    const router = express.Router();

    // Kill Route
    router.post('/kill', async (req, res) => {
        const { playerId, targetId, successChance } = req.body;

        try {
            const attacker = await Player.findById(playerId);
            const target = await Player.findById(targetId);

            if (!attacker || !target) {
                return res.status(404).json({ message: 'Attacker or target not found' });
            }

            // Check jail status
            if (attacker.jail?.isInJail) {
                return res.status(403).json({ message: 'Attacker is in jail and cannot attack' });
            }
            if (target.jail?.isInJail) {
                return res.status(403).json({ message: 'Target is in jail and cannot be attacked' });
            }

            // Check cooldown
            const currentTime = new Date();
            if (attacker.cooldown && new Date(attacker.cooldown) > currentTime) {
                return res.status(403).json({ message: 'Attacker is in cooldown and cannot attack' });
            }

            // Determine success
            if (calculateSuccessChance(successChance)) {
                const stolenMoney = transferMoney(attacker, target, 0.11);
                const stolenItem = transferItem(attacker, target);
                attacker.xp += 50;
                setCooldown(attacker, 1);

                await attacker.save();
                await target.save();

                // Emit update via Socket.IO
                io.to(`player-${targetId}`).emit('attacked', {
                    success: true,
                    attacker: attacker.username,
                    stolenMoney,
                    stolenItem,
                });

                return res.json({
                    success: true,
                    message: `Attack was successful! You stole ${stolenMoney} money and ${stolenItem?.name || 'an item'}.`,
                });
            } else {
                const lostMoney = loseMoney(attacker, 0.10);
                sendToJail(attacker, 2);
                setCooldown(attacker, 2);

                if (attacker.inventory.length > 0) {
                    const highestValueItem = attacker.inventory.reduce((max, item) =>
                        item.value > max.value ? item : max
                    );
                    attacker.inventory = attacker.inventory.filter(item => item !== highestValueItem);
                    target.inventory.push(highestValueItem);
                }

                await attacker.save();
                await target.save();

                io.to(`player-${targetId}`).emit('attacked', {
                    success: false,
                    attacker: attacker.username,
                });

                return res.json({
                    success: false,
                    message: `Attack failed. You lost ${lostMoney} money, were sent to jail, and lost a valuable item.`,
                });
            }
        } catch (error) {
            console.error('Error in kill route:', error);
            res.status(500).json({ message: 'An error occurred during the attack attempt.' });
        }
    });

    return router;
};
