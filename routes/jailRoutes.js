const express = require('express');
const { sendToJail, checkJailStatus } = require('../helpers/jailHelper');
const Player = require('../models/Player');
const Notification = require('../models/notifications');

const jailRoutes = (io) => {
    const router = express.Router();

// Definieer rankDurations
const rankDurations = {
    Rookie: 5,
    Associate: 10,
    Soldier: 20,
    Capo: 30,
    Underboss: 40,
    Don: 50,
    Godfather: 60,
};

// POST - Send Player to Jail
router.post('/jail/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    const { jailTime } = req.body; // jailTime blijft optioneel

    if (!walletAddress || (!jailTime && jailTime !== 0)) {
        return res.status(400).json({ message: 'Wallet address and jail time are required.' });
    }

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) {
            return res.status(404).json({ message: 'Player not found.' });
        }

        // Gebruik jailTime als het expliciet is opgegeven, anders bereken op basis van rang
        let finalJailTime = jailTime; // Prioriteit aan opgegeven jailTime
        if (!jailTime) {
            const rank = player.rank || 'Rookie';
            finalJailTime = rankDurations[rank] || 5; // Standaard naar 5 minuten als rang onbekend is
        }

        // Bereken vrijlatingstijd
        const jailReleaseTime = new Date(Date.now() + finalJailTime * 60 * 1000);
        player.jail = {
            isInJail: true,
            jailReleaseTime,
        };
        await player.save();

        // Maak een nieuwe notificatie aan
        const notification = new Notification({
            userId: player._id,
            message: `You have been sent to jail. Release time: ${jailReleaseTime.toLocaleTimeString()}.`,
        });
        await notification.save();
        console.log(`Jail notification created for user: ${player._id}`);

        // Emit de bijgewerkte jail status naar de frontend
        req.app.get('io')?.to(walletAddress).emit('jailStatusUpdated', {
            walletAddress,
            isInJail: true,
            jailReleaseTime,
        });
        console.log(`Jail status emitted to wallet: ${walletAddress}`);

        res.status(200).json({
            message: 'Player jailed successfully.',
            jail: {
                isInJail: true,
                jailReleaseTime,
            },
        });
    } catch (error) {
        console.error('Error in sendToJail route:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



// POST - Release Player from Jail
router.post('/release-jail/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    try {
        const player = await Player.findOne({ walletAddress });

        // Check if the player exists
        if (!player) {
            console.error(`[Release Jail] Player not found for wallet: ${walletAddress}`);
            return res.status(404).json({ message: 'Player not found.' });
        }

        // Check if the player is in jail
        if (!player.jail.isInJail) {
            console.warn(`[Release Jail] Player ${walletAddress} is not in jail.`);
            return res.status(400).json({ message: 'Player is not in jail.' });
        }

        // Release the player from jail
        player.jail.isInJail = false;
        player.jail.jailReleaseTime = null;
        await player.save();

        console.log(`[Release Jail] Player ${walletAddress} jail status updated.`);

        // Check if a release notification already exists
        const existingNotification = await Notification.findOne({
            userId: player._id,
            message: 'You have been released from jail.',
        });

        if (!existingNotification) {
            // Create a new notification
            const notification = new Notification({
                userId: player._id,
                message: 'You have been released from jail.',
            });

            await notification.save();
            console.log(`[Release Jail] Release notification created for user: ${player._id}`);
        } else {
            console.log(`[Release Jail] Release notification already exists for user: ${player._id}`);
        }

        // Emit a jail status update to the frontend
        if (io) {
            io.to(walletAddress).emit('jailStatusUpdated', {
                walletAddress,
                isInJail: false,
                jailReleaseTime: null,
            });
            console.log(`[Release Jail] Emitted jail release event for wallet: ${walletAddress}`);
        }

        res.status(200).json({ message: 'Player released from jail successfully.' });
    } catch (error) {
        console.error(`[Release Jail] Error releasing player ${walletAddress}:`, error);
        res.status(500).json({ message: 'An error occurred while releasing the player from jail.' });
    }
});


// GET - Jail Status
    router.get('/jail-status/:walletAddress', async (req, res) => {
        const { walletAddress } = req.params;

        try {
            const jailStatus = await checkJailStatus(walletAddress);

            if (!jailStatus) {
                return res.status(404).json({ message: 'Player not found or no jail status available' });
            }

        // Correctly determine if the player is in jail
        const isInJail = !!jailStatus.jailReleaseTime && new Date(jailStatus.jailReleaseTime) > new Date();

        const releaseTime = jailStatus.jailReleaseTime
            ? new Date(jailStatus.jailReleaseTime).toISOString()
            : null;

        res.status(200).json({
            walletAddress,
            isInJail,
            jailReleaseTime: releaseTime,
        });

            // Emit real-time update via Socket.IO
            if (io) {
                io.to(walletAddress).emit('jailStatusUpdated', {
                    walletAddress,
                    isInJail: jailStatus.isInJail,
                    jailReleaseTime: releaseTime,
                });
                console.log(`Jail status updated and emitted for wallet: ${walletAddress}`);
            }
        } catch (error) {
            console.error('Error checking jail status:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    });

// GET - Retrieve all players currently in jail
router.get('/jail-list', async (req, res) => {
    try {
        // Haal zowel spelers zonder familie als met familie op
        const playersInJail = await Player.find({ 
            "jail.isInJail": true
        }).select('username rank jail family walletAddress'); // Je kunt familie en andere velden specificeren die je nodig hebt

        // Format players' data with proper jailReleaseTime
        const formattedPlayers = playersInJail.map((player) => ({
            ...player.toObject(),
            jail: {
                ...player.jail,
                jailReleaseTime: player.jail.jailReleaseTime
                    ? new Date(player.jail.jailReleaseTime).toISOString()
                    : null,
            },
        }));

        // Stuur de geformatteerde data terug naar de frontend
        res.status(200).json(formattedPlayers);
    } catch (error) {
        console.error('Error fetching players in jail:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});



router.post('/bailout/:walletAddress/:familyMemberAddress?', async (req, res) => {
    const { walletAddress, familyMemberAddress } = req.params;

    try {
        const bailer = await Player.findOne({ walletAddress });
        if (!bailer) {
            console.error('Bailer not found:', walletAddress);
            return res.status(404).json({ message: 'Bailer not found' });
        }

        const targetAddress = familyMemberAddress || walletAddress; // Default to self if no family member
        const targetPlayer = await Player.findOne({ walletAddress: targetAddress });

        if (!targetPlayer) {
            console.error('Target player not found:', targetAddress);
            return res.status(404).json({ message: 'Player to bail out not found' });
        }

        if (walletAddress === targetAddress) {
            return res.status(400).json({ message: 'You cannot bail yourself out' });
        }

        // Debugging: log the player data and bailout calculation
        console.log('Bailer Data:', bailer);
        console.log('Target Player Data:', targetPlayer);

        let bailoutCost;
        try {
            bailoutCost = calculateBailoutCost(targetPlayer);
            console.log('Calculated bailout cost:', bailoutCost);  // Debugging bailout cost calculation
        } catch (err) {
            console.error('Error calculating bailout cost:', err);
            return res.status(500).json({ message: 'Error calculating bailout cost' });
        }

        if (bailer.money < bailoutCost) {
            console.error(`Insufficient funds: ${bailer.money} < ${bailoutCost}`);
            return res.status(400).json({ message: `Insufficient funds to bail out. Cost: ${bailoutCost}` });
        }

        if (!targetPlayer.jail) {
            console.error('Target player jail data is missing:', targetPlayer);
            return res.status(500).json({ message: 'Target player jail data is missing' });
        }

        // Debugging: log before saving
        console.log('Before processing bailout:', {
            bailerMoney: bailer.money,
            targetPlayerJailStatus: targetPlayer.jail.isInJail,
        });

        // Process bailout
        bailer.money -= bailoutCost;
        targetPlayer.jail.isInJail = false;
        targetPlayer.jail.jailReleaseTime = null;

        try {
            await Promise.all([bailer.save(), targetPlayer.save()]);
        } catch (err) {
            console.error('Error saving player data:', err);
            return res.status(500).json({ message: 'Error saving player data' });
        }

        if (io) {
            io.to(targetAddress).emit('jailStatusUpdated', {
                walletAddress: targetAddress,
                isInJail: false,
                jailReleaseTime: null,
            });
            console.log(`Player bailed out: ${targetAddress}`);
        } else {
            console.error('Socket.io instance not initialized');
        }

        res.status(200).json({
            message: `${targetPlayer.username} was successfully bailed out`,
            remainingMoney: bailer.money,
        });
    } catch (error) {
        console.error('Unexpected error during bailout:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});





    return router;
};

module.exports = jailRoutes;
