module.exports = (io) => {
const express = require('express');
const router = express.Router();
const Territory = require('../models/territory');
const Family = require('../models/family');
const Player = require('../models/Player'); // Zorg dat het pad naar je Player-model correct is
const { checkCooldown, setCooldown } = require('../helpers/cooldownhelper');
const { sendTerritoryUpdate, sendLeaderboardUpdate, sendFamilyUpdate } = require('../helpers/socketEvents');

// --------------------------- Helper Functions ---------------------------

/**
 * Calculate total income with income boost.
 * @param {Array} territories - List of controlled territories.
 * @param {Number} incomeBoost - Percentage income boost.
 * @returns {Number} Total income with boost.
 */
const calculateTotalIncome = (territories, incomeBoost) => {
    const baseIncome = territories.reduce((total, territory) => total + territory.resourceIncome, 0);
    return baseIncome + Math.round((baseIncome * incomeBoost) / 100);
};

/**
 * Validate family existence.
 * @param {String} familyId - Family ID to validate.
 * @returns {Object} Family document or error.
 */
const validateFamily = async (familyId) => {
    const family = await Family.findById(familyId);
    if (!family) throw new Error('Family not found');
    return family;
};

// --------------------------- Territories Routes ---------------------------

/**
 * Fetch all territories.
 */
router.get('/territories', async (req, res) => {
    try {
        const territories = await Territory.find();
        res.status(200).json(territories);
    } catch (error) {
        console.error('Error fetching territories:', error);
        res.status(500).json({ message: 'Failed to fetch territories' });
    }
});

/**
 * Claim a territory.
 */
router.post('/territory/claim', async (req, res) => {
    const { familyId, territoryId } = req.body;

    try {
        // Check cooldown
        const cooldown = await checkCooldown(familyId, 'claim', 300000); // 5 minutes cooldown
        if (cooldown.active) {
            return res.status(429).json({
                message: `Action is on cooldown. Try again later.`,
                remaining: cooldown.remaining,
            });
        }

        const family = await Family.findById(familyId);
        const territory = await Territory.findById(territoryId);

        if (!family || !territory) {
            return res.status(404).json({ message: 'Family or Territory not found.' });
        }

        if (territory.status !== 'free') {
            return res.status(400).json({ message: 'Territory is not available for claim' });
        }

        const claimCost = 50 + (territory.dominancePoints || 0) * 2;

        if (family.resources < claimCost) {
            return res.status(400).json({ message: `Not enough resources. Required: ${claimCost}` });
        }

        // Deduct resources and claim the territory
        family.resources -= claimCost;
        territory.controlledBy = familyId;
        territory.status = 'controlled';

        await family.save();
        await territory.save();

        // Set cooldown
        await setCooldown(familyId, 'claim');

        // Emit real-time updates
        io.to(`family-${familyId}`).emit('territory-update', {
            territoryId: territory._id,
            status: 'controlled',
            controlledBy: familyId,
            dominancePoints: territory.dominancePoints,
        });

        // Notify all families about the territory update
        io.emit('territory-update', {
            territoryId: territory._id,
            status: 'controlled',
            controlledBy: familyId,
        });

        res.status(200).json({ message: 'Territory claimed successfully', territory });
    } catch (error) {
        console.error('Error claiming territory:', error);
        res.status(500).json({ message: 'Failed to claim territory' });
    }
});




/**
 * Sabotage a territory.
 */
router.post('/territory/sabotage', async (req, res) => {
    const { attackerId, targetFamilyId, territoryId } = req.body;

    try {
        const cooldownDuration = 600000; // 10 minutes cooldown
        const cooldown = await checkCooldown(attackerId, 'sabotage', cooldownDuration);

        if (cooldown.active) {
            return res.status(429).json({
                message: 'Action is on cooldown. Try again later.',
                remaining: cooldown.remaining,
            });
        }

        const attacker = await Family.findById(attackerId);
        const targetFamily = targetFamilyId ? await Family.findById(targetFamilyId) : null;
        const territory = await Territory.findById(territoryId);

        if (!attacker || !territory) {
            return res.status(404).json({ message: 'Attacker or Territory not found.' });
        }

        const sabotageCost = 50 + (attacker.upgrades.armory || 0) * 10;
        if (attacker.resources < sabotageCost) {
            return res.status(400).json({
                message: `Not enough resources. Required: ${sabotageCost}, available: ${attacker.resources}`,
            });
        }

        // Deduct resources
        attacker.resources -= sabotageCost;

        // Calculate success
        const sabotageChance = 50 + (attacker.upgrades.armory || 0) * 5;
        const success = Math.random() * 100 < sabotageChance;

        if (!success) {
            // On failure, reduce dominance points and reward defender
            const failurePenalty = 5;
            territory.dominancePoints = Math.max(0, territory.dominancePoints - failurePenalty);

            if (targetFamily) {
                targetFamily.resources += 10; // Reward defender
                await targetFamily.save();
            }

            await territory.save();
            await attacker.save();

            // Emit real-time failure update
            io.to(`family-${attackerId}`).emit('territory-update', {
                territoryId: territory._id,
                status: territory.status,
                controlledBy: territory.controlledBy,
                dominancePoints: territory.dominancePoints,
            });

            return res.status(400).json({ message: 'Sabotage failed!' });
        }

        // On success, reduce dominance points
        const sabotageImpact = 10 + (attacker.upgrades.armory || 0) * 5;
        territory.dominancePoints = Math.max(0, territory.dominancePoints - sabotageImpact);

        if (territory.dominancePoints === 0) {
            // Take over territory
            territory.controlledBy = attackerId;
            territory.status = 'controlled';
            attacker.points += 50;
        } else {
            attacker.points += 20;
        }

        await territory.save();
        await attacker.save();

        // Set cooldown
        await setCooldown(attackerId, 'sabotage');

        // Emit success updates to attacker and defender
        io.to(`family-${attackerId}`).emit('territory-update', {
            territoryId: territory._id,
            status: territory.status,
            controlledBy: territory.controlledBy,
            dominancePoints: territory.dominancePoints,
        });

        if (targetFamilyId) {
            io.to(`family-${targetFamilyId}`).emit('territory-update', {
                territoryId: territory._id,
                status: territory.status,
                controlledBy: territory.controlledBy,
                dominancePoints: territory.dominancePoints,
            });
        }

        // Emit cooldown update for the attacker
        io.to(`family-${attackerId}`).emit('update-cooldowns', {
            action: 'sabotage',
            cooldown: cooldownDuration,
            timestamp: Date.now(),
        });

        res.status(200).json({ message: 'Sabotage successful', territory });
    } catch (error) {
        console.error('Error performing sabotage:', error);
        res.status(500).json({ message: 'Failed to sabotage' });
    }
});







router.get('/territory/sabotage-cost', async (req, res) => {
    const { familyId } = req.query;

    try {
        const family = await Family.findById(familyId);
        if (!family) {
            return res.status(404).json({ message: 'Family not found' });
        }

        const sabotageCost = 50 + (family.upgrades.armory || 0) * 10; // Bereken kosten
        res.status(200).json({ cost: sabotageCost });
    } catch (error) {
        console.error('Error fetching sabotage cost:', error);
        res.status(500).json({ message: 'Failed to fetch sabotage cost' });
    }
});



/**
 * Reset limited-control territories.
 */
router.post('/territories/reset-limited', async (req, res) => {
    try {
        const now = new Date();
        await Territory.updateMany(
            { limitedControlTime: { $lte: now } },
            { $set: { status: 'free', controlledBy: null, limitedControlTime: null } }
        );
        res.status(200).json({ message: 'Limited territories reset successfully' });
    } catch (error) {
        console.error('Error resetting limited territories:', error);
        res.status(500).json({ message: 'Failed to reset limited territories' });
    }
});

// --------------------------- Family Routes ---------------------------

/**
 * Family dashboard.
 */
// API om de dashboardgegevens op te halen
router.get('/dashboard/:familyId', async (req, res) => {
    try {
        const { familyId } = req.params;

        console.log(`Fetching dashboard data for familyId: ${familyId}`);

        // Zoek de familie op basis van familyId
        const family = await Family.findById(familyId);
        if (!family) {
            console.error(`Family with ID ${familyId} not found.`);
            return res.status(404).json({ message: 'Family not found' });
        }

        console.log(`Family found: ${family.name}`);

        // Haal de territories op die door deze familie worden gecontroleerd
        const territories = await Territory.find({ controlledBy: familyId });

        console.log(`Territories found for family ${family.name}: ${territories.length}`);

        // Bouw de response op
        const response = {
            family: {
                _id: family._id,
                name: family.name,
                money: family.money || 0,
                resources: family.resources || 0,
                upgrades: family.upgrades || { armory: 0, defense: 0, income: 0 },
                dominancePoints: family.dominancePoints || 0,
            },
            territories,
        };

        // Stuur de response terug naar de frontend
        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching dashboard data:', error.message);
        res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
    }
});

  
/**
 * Get dominance points.
 */
router.get('/dominance/:familyId', async (req, res) => {
    try {
        const territories = await Territory.find({ controlledBy: req.params.familyId });
        const totalDominance = territories.reduce(
            (total, territory) => total + (territory.dominancePoints || 0),
            0
        );
        res.status(200).json({ dominancePoints: totalDominance });
    } catch (error) {
        console.error('Error calculating dominance:', error);
        res.status(500).json({ message: 'Failed to calculate dominance points' });
    }
});

/**
 * Get leaderboard.
 */
/**
 * Get family leaderboard based on points.
 */
router.get('/leaderboard', async (req, res) => {
    try {
        const leaderboard = await Family.find({})
            .sort({ points: -1 }) // Sorteer op punten
            .select('name points resources -_id')
            .limit(10); // Top 10 families

        res.status(200).json(leaderboard);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
});


// --------------------------- Upgrades Routes ---------------------------

/**
/* Upgrade family stats. */
router.post('/upgrade', async (req, res) => {
    const { familyId, upgradeType } = req.body;

    try {
        console.log(`Received upgrade request for family: ${familyId}, type: ${upgradeType}`);

        // Validaties
        const family = await Family.findById(familyId);
        if (!family) {
            console.error(`Family not found: ${familyId}`);
            return res.status(404).json({ message: 'Family not found' });
        }

        if (!['armory', 'defense', 'income'].includes(upgradeType)) {
            console.error(`Invalid upgrade type: ${upgradeType}`);
            return res.status(400).json({ message: 'Invalid upgrade type' });
        }

        // Berekening van kosten op basis van huidig level
        const currentLevel = family.upgrades[upgradeType] || 0;

        // Resourcekosten
        const resourceCost = Math.ceil(100 * Math.pow(1.5, currentLevel));

        // Geldkosten
        const moneyCost = Math.ceil(200 * Math.pow(1.3, currentLevel)); // Geldkosten stijgen iets minder snel

        console.log(`Upgrade costs - Resources: ${resourceCost}, Money: ${moneyCost}`);
        console.log(`Current resources: ${family.resources}, Money: ${family.money}`);

        // Controleer of de familie voldoende resources en geld heeft
        if (family.resources < resourceCost || family.money < moneyCost) {
            console.error('Not enough resources or money for upgrade.');
            return res.status(400).json({
                message: `Not enough resources or money. Required: ${resourceCost} resources, ${moneyCost} money. Available: ${family.resources} resources, ${family.money} money.`,
            });
        }

        // Trek de kosten af
        family.resources -= resourceCost;
        family.money -= moneyCost;

        // Voer de upgrade uit
        family.upgrades[upgradeType] = currentLevel + 1;
        family.points += 10; // Optioneel: punten voor ranglijst

        await family.save();

        // Real-time updates via Socket.IO
        io.to(`family-${familyId}`).emit('family-update', {
            resources: family.resources,
            money: family.money,
            upgrades: family.upgrades,
        });

        res.status(200).json({
            message: `${upgradeType.charAt(0).toUpperCase() + upgradeType.slice(1)} upgraded successfully`,
            upgrades: family.upgrades,
            resources: family.resources,
            money: family.money,
        });
    } catch (error) {
        console.error('Error upgrading family:', error);
        res.status(500).json({ message: 'Failed to upgrade family' });
    }
});




/**
 * Get the cost of upgrading a family attribute.
 */
router.get('/upgrade-cost', async (req, res) => {
    const { familyId, upgradeType } = req.query;

    // Valideer invoer
    if (!familyId) {
        return res.status(400).json({ message: 'Missing familyId in request' });
    }

    if (!['armory', 'defense', 'income'].includes(upgradeType)) {
        return res.status(400).json({ message: 'Invalid upgrade type' });
    }

    try {
        console.log('Received query:', { familyId, upgradeType });

        // Zoek de familie
        const family = await Family.findById(familyId);
        if (!family) {
            return res.status(404).json({ message: 'Family not found' });
        }

        console.log('Family found:', family);

        // Bereken upgrade kosten
        const currentLevel = family.upgrades[upgradeType] || 0;
        const upgradeCost = Math.ceil(100 * Math.pow(1.5, currentLevel));

        console.log('Calculated cost:', { upgradeType, currentLevel, upgradeCost });

        // Geef de kosten terug
        return res.status(200).json({ cost: upgradeCost });
    } catch (error) {
        console.error('Error fetching upgrade cost:', error);
        return res.status(500).json({ message: 'Failed to fetch upgrade cost' });
    }
});


// --------------------------- Resources Routes ---------------------------

/**
 * Collect resources.
 */
router.post('/collect-resources/:familyId', async (req, res) => {
    const { familyId } = req.params;

    try {
        const cooldownDuration = 86400000; // 24 hours

        const cooldown = await checkCooldown(familyId, 'collect', cooldownDuration);
        if (cooldown.active) {
            return res.status(429).json({
                message: 'You can only collect resources once every 24 hours.',
                remaining: cooldown.remaining,
            });
        }

        const family = await Family.findById(familyId);
        if (!family) {
            return res.status(404).json({ message: 'Family not found.' });
        }

        const territories = await Territory.find({ controlledBy: familyId });

        // Calculate total resources and dominance points
        const totalResources = territories.reduce(
            (sum, territory) => sum + (territory.resourceIncome || 0),
            0
        );
        const totalDominancePoints = territories.reduce(
            (sum, territory) => sum + (territory.dominancePoints || 0),
            0
        );

        family.resources += totalResources;
        family.dominancePoints += totalDominancePoints;

        await family.save();
        await setCooldown(familyId, 'collect');

        // Emit resources update to family room
        io.to(`family-${familyId}`).emit('update-resources', {
            resources: family.resources,
            dominancePoints: family.dominancePoints,
        });

        // Emit cooldown update
        io.to(`family-${familyId}`).emit('update-cooldowns', {
            action: 'collect',
            cooldown: cooldownDuration,
            timestamp: Date.now(),
        });

        res.status(200).json({
            message: 'Resources collected successfully.',
            resources: family.resources,
            dominancePoints: family.dominancePoints,
        });
    } catch (error) {
        console.error('Error collecting resources:', error);
        res.status(500).json({ message: 'Failed to collect resources.' });
    }
});



// --------------------------- Events Routes ---------------------------

/**
 * Declare event winner.
 */
router.post('/event/declare-winner', async (req, res) => {
    const { familyId } = req.body;

    try {
        const family = await validateFamily(familyId);
        const hasSuperTerritory = await Territory.findOne({
            controlledBy: familyId,
            name: 'Super Territorium',
        });

        if (!hasSuperTerritory) {
            return res.status(400).json({ message: 'Family does not control the Super Territorium' });
        }

        const winDate = new Date();
        winDate.setHours(winDate.getHours() + 24);
        family.winningCondition = { superTerritory: true, winDate };

        await family.save();
        res.status(200).json({ message: 'Win condition initiated', family });
    } catch (error) {
        console.error('Error declaring winner:', error);
        res.status(500).json({ message: 'Failed to declare winner' });
    }
});

router.post('/contribute', async (req, res) => {
    const { playerId, familyId, amount } = req.body;

    try {
        const player = await Player.findById(playerId);
        const family = await Family.findById(familyId);

        if (!player || !family) {
            return res.status(404).json({ message: 'Player or Family not found' });
        }

        if (player.money < amount) {
            return res.status(400).json({ message: 'Not enough money to contribute.' });
        }

        // Update speler en familie
        player.money -= amount;
        family.resources += amount;

        await player.save();
        await family.save();

        // Emit real-time updates
        io.to(`family-${familyId}`).emit('family-contribution', {
            playerId,
            amount,
            totalResources: family.resources,
        });

        res.status(200).json({ message: 'Contribution successful', family });
    } catch (error) {
        console.error('Error contributing money:', error);
        res.status(500).json({ message: 'Failed to contribute money' });
    }
});

    // --------------------------- Cooldown Routes ---------------------------

    /**
     * Get cooldown status for a family.
     */
    router.get('/cooldowns', async (req, res) => {
        const { familyId } = req.query;

        try {
            const claimCooldown = await checkCooldown(familyId, 'claim', 300000); // 5 minutes
            const sabotageCooldown = await checkCooldown(familyId, 'sabotage', 600000); // 10 minutes
            const collectCooldown = await checkCooldown(familyId, 'collect', 900000); // 15 minutes
            const upgradeCooldown = await checkCooldown(familyId, 'upgrade', 1200000); // 20 minutes

            res.status(200).json({
                cooldowns: {
                    claim: claimCooldown,
                    sabotage: sabotageCooldown,
                    collect: collectCooldown,
                    upgrade: upgradeCooldown,
                },
            });
        } catch (error) {
            console.error('Error fetching cooldowns:', error);
            res.status(500).json({ message: 'Failed to fetch cooldowns' });
        }
    });

    /**
     * Start cooldown for a specific action.
     */
    router.post('/start-cooldown', async (req, res) => {
        const { familyId, action } = req.body;
        const durations = {
            claim: 300000, // 5 minutes
            sabotage: 600000, // 10 minutes
            collect: 900000, // 15 minutes
            upgrade: 1200000, // 20 minutes
        };

        const duration = durations[action];
        try {
            await setCooldown(familyId, action);
            res.status(200).json({ message: 'Cooldown started successfully', action });
        } catch (error) {
            console.error('Error starting cooldown:', error);
            res.status(500).json({ message: 'Failed to start cooldown' });
        }
    });

    router.get('/request-cooldown/:familyId', async (req, res) => {
        const { familyId } = req.params;
    
        try {
            const cooldowns = {
                claim: await checkCooldown(familyId, 'claim', 21600000), // 6 uur
                sabotage: await checkCooldown(familyId, 'sabotage', 21600000), // 6 uur
                collect: await checkCooldown(familyId, 'collect', 86400000), // 24 uur
                upgrade: await checkCooldown(familyId, 'upgrade', 1200000), // 20 minuten
            };
    
            // Verwijder deze regel om dubbele emissies te vermijden
            // io.to(`family-${familyId}`).emit('update-cooldowns', cooldowns);
    
            res.status(200).json({
                message: 'Cooldowns updated successfully.',
                cooldowns,
            });
        } catch (error) {
            console.error('Error fetching cooldowns:', error);
            res.status(500).json({ message: 'Failed to fetch cooldowns.' });
        }
    });
    
    


///////////////////////DONATE////////////////////////////////
router.post('/family/donate', async (req, res) => {
    const { familyId, playerId, amount } = req.body;

    console.log('Donation request received:', { familyId, playerId, amount });

    try {
        const player = await Player.findOne({
            $or: [
              { walletAddress: playerId }, // If playerId is walletAddress
              { username: playerId },      // If playerId is username
            ],
          });
        const family = await Family.findById(familyId);

        if (!player || !family) {
            console.error('Player or Family not found:', { player, family });
            return res.status(404).json({ message: 'Player or Family not found' });
        }

        if (player.money < amount) {
            console.error('Player does not have enough money:', { available: player.money, required: amount });
            return res.status(400).json({ message: 'Not enough money to donate' });
        }

        // Update player and family balances
        player.money -= amount;
        family.money += amount;

        await player.save();
        await family.save();

        console.log('Donation successful:', { playerMoney: player.money, familyMoney: family.money });

        io.to(`family-${familyId}`).emit('family-update', {
            money: family.money,
            resources: family.resources,
            upgrades: family.upgrades,
        });

        res.status(200).json({ message: 'Donation successful', money: family.money });
    } catch (error) {
        console.error('Error processing donation:', error);
        res.status(500).json({ message: 'Failed to donate money' });
    }
});

////////////////////////livechat/////////////////////////////
// Endpoint om berichten op te halen
// Endpoint om de laatste 100 berichten op te halen
router.get('/:familyId/chat', async (req, res) => {
    try {
      const { familyId } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
  
      const family = await Family.findById(familyId, 'chatHistory');
      if (!family) {
        return res.status(404).json({ message: 'Family not found' });
      }
  
      const chatHistory = family.chatHistory
        .slice(-limit - offset, -offset || undefined)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
      res.status(200).json({ chatHistory });
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  




// Endpoint om een bericht toe te voegen
router.post('/:familyId/chat', async (req, res) => {
    try {
        const { familyId } = req.params;
        const { sender, message } = req.body;

        if (!sender || !message) {
            return res.status(400).json({ message: 'Sender and message are required' });
        }

        const family = await Family.findById(familyId);
        if (!family) {
            return res.status(404).json({ message: 'Family not found' });
        }

        // Voeg het nieuwe bericht toe aan de chatHistory
        family.chatHistory.push({ sender, message, timestamp: new Date() });
        await family.save();

        res.status(201).json({ message: 'Message added', chatHistory: family.chatHistory });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// (Optioneel) Endpoint om chatgeschiedenis te verwijderen
router.delete('/:familyId/chat', async (req, res) => {
    try {
        const { familyId } = req.params;
        const family = await Family.findById(familyId);
        if (!family) {
            return res.status(404).json({ message: 'Family not found' });
        }

        // Wis de chatgeschiedenis
        family.chatHistory = [];
        await family.save();

        res.status(200).json({ message: 'Chat history cleared' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
    



return router;

}; 