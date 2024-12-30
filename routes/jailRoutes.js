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

const calculateRankMultiplier = (rank) => {
    const rankMapping = {
        "Capo": 3,
        "Soldato": 2,
        "Boss": 5,
        "Underboss": 4,
        "Don": 6,
    };
    return rankMapping[rank] || 1; // Default to 1 if rank is not found
};

const calculateBailoutCost = (player) => {
    const baseCost = 1000;
    
    // Verkrijg de rang van de speler
    const rank = player.rank;
    let rankMultiplier = calculateRankMultiplier(rank);
    
    if (rankMultiplier === 1) {
        console.error('Invalid rank for player:', player.username, 'Rank:', rank);
    }
    
    // Bereken de tijdsstraffen op basis van het verblijf in de gevangenis
    let timePenalty = 0;
    if (player.jail && player.jail.jailReleaseTime) {
        const jailReleaseTime = new Date(player.jail.jailReleaseTime).getTime();
        if (isNaN(jailReleaseTime)) {
            console.error('Invalid jailReleaseTime for player:', player.username);
            return 0; // Return 0 als jailReleaseTime ongeldig is
        }
    
        const timeInJail = (jailReleaseTime - Date.now()) / 1000; // Tijd in seconden
        timePenalty = timeInJail > 0 ? timeInJail * 1 : 0; // Verhoog de penalty bij langere tijd in de gevangenis
    }

    // Totale kosten
    const totalCost = baseCost * rankMultiplier + timePenalty;

    // Afronden naar 2 decimalen
    const roundedCost = Math.round(totalCost * 100) / 100;
    
    return roundedCost;
};

// Stel een route in om de bail-out kosten te berekenen
app.post('/api/jail/bailout-cost/:walletAddress/:inmateAddress', async (req, res) => {
    const { walletAddress, inmateAddress } = req.params;
    
    try {
        // Haal de gegevens van de speler en de gevangene op (bijvoorbeeld via een database)
        const player = await getPlayerData(walletAddress); // Haal de spelerdata op
        const inmate = await getInmateData(inmateAddress); // Haal de gevangene data op

        if (!player || !inmate) {
            return res.status(404).json({ message: 'Player or inmate not found' });
        }

        // Bereken de bail-out kosten
        const bailoutCost = calculateBailoutCost(player);

        res.json({
            success: true,
            bailoutCost: bailoutCost,
            message: `Bailout cost for ${inmate.username}: ${bailoutCost}`,
        });
    } catch (error) {
        console.error('Error calculating bailout cost:', error);
        res.status(500).json({ message: 'Error calculating bailout cost' });
    }
});

// Functies om speler en gevangene gegevens op te halen (bijvoorbeeld uit een database)
const getPlayerData = async (walletAddress) => {
    // Implementeer hier logica om spelerdata op te halen (bijv. uit een DB)
    return { walletAddress, rank: 'Capo', jail: { jailReleaseTime: Date.now() + 3600 * 1000 } }; // Voorbeeld
};

const getInmateData = async (inmateAddress) => {
    // Implementeer hier logica om gevangene data op te halen (bijv. uit een DB)
    return { username: 'Inmate123', walletAddress: inmateAddress }; // Voorbeeld
};

// Start de server
app.listen(5000, () => {
    console.log('Server started on port 5000');
});


    return router;
};

module.exports = jailRoutes;
