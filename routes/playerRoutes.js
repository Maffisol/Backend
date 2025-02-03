const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const jailCheck = require('../middleware/jailCheck');
const Game = require('../models/Game');
const { sendToJail } = require('../helpers/jailHelper');  // Import sendToJail from jailHelper.js


// Helper function to update rank based on points
const updatePlayerRank = async (player) => {
    const rankThresholds = [
        { rank: 'Godfather', points: 100000 },
        { rank: 'Don', points: 50000 },
        { rank: 'Underboss', points: 25000 },
        { rank: 'Capo', points: 10000 },
        { rank: 'Soldier', points: 5000 },
        { rank: 'Associate', points: 1000 },
        { rank: 'Rookie', points: 0 },
    ];

    const currentRank = rankThresholds.find(threshold => player.points >= threshold.points)?.rank || 'Rookie';
    if (player.rank !== currentRank) {
        player.rank = currentRank;
        await player.save();
    }
};

// POST - Login: Check if player with walletAddress exists
router.post('/login', async (req, res) => {
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ message: 'Wallet address is required.' });
    }

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        // Return the player data or prompt for username if missing
        res.status(200).json(player);
    } catch (error) {
        console.error('Error checking user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST - Create new player with username and walletAddress
router.post('/createPlayer', async (req, res) => {
    const { walletAddress, username } = req.body;

    if (!walletAddress || !username) {
        return res.status(400).json({ message: 'Wallet address and username are required.' });
    }

    try {
        let player = await Player.findOne({ walletAddress });
        if (player && player.username) {
            return res.status(400).json({ message: 'Player with this wallet already exists.' });
        }

        const existingUser = await Player.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username is already taken.' });
        }

        if (player && !player.username) {
            player.username = username;
            await player.save();
            return res.status(200).json(player);
        }

        const newPlayer = new Player({
            walletAddress,
            username,
            points: 0,
            rank: 'Rookie',
            isPro: false,
            family: null,
            createdAt: new Date(),
            base: { stage: 1, expansions: { garage: 0, weapons: 0, cars: 0 } },
            missions: {
                completedMissions: 0,
                lastMissionDate: null,
                activeMission: { missionId: null, progress: 0, reward: 0 }
            },
            money: 600,
            jail: { isInJail: false, jailReleaseTime: null },
            inbox: [] // Initialize with an empty inbox array
        });

        await newPlayer.save();
        return res.status(201).json(newPlayer);
    } catch (error) {
        console.error('Error creating player:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});


// GET - Retrieve player data by walletAddress
router.get('/profile/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ message: 'Wallet address is required' });
    }

    try {
        const player = await Player.findOne({ walletAddress })
            .populate({
                path: 'family',
                select: 'name', // Only select the family name
            })
            .populate('upgrades.upgradeId'); // Populate the upgradeId to get full upgrade details

        if (!player) {
            console.log(`Player with walletAddress ${walletAddress} not found.`);
            return res.status(404).json({ message: 'Player not found' });
        }

        const baseUpgradesCount = player.upgrades ? player.upgrades.length : 0;
        const inventoryItemsCount = player.inventory ? player.inventory.length : 0;

        // Transform upgrades data to ensure upgradeId is a string
        const transformedUpgrades = player.upgrades.map((upgrade) => ({
            ...upgrade.toObject(),
            upgradeId: upgrade.upgradeId?._id.toString(),
        }));

        // Include the additional fields in the response
        return res.status(200).json({
            username: player.username,
            points: player.points,
            rank: player.rank,
            family: player.family ? player.family.name : 'No Family',
            isPro: player.isPro,
            money: player.money,
            baseUpgradesCount,
            inventoryItemsCount,
            bags: player.bags || 0,
            ounces: player.ounces || 0,
            halfKilos: player.halfKilos || 0,
            kilos: player.kilos || 0,
            lastOuncePurchase: player.lastOuncePurchase,
            upgrades: transformedUpgrades, // Add transformed upgrades
        });
    } catch (error) {
        console.error('Error fetching player data:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});






// POST - Bail a family member out of jail
router.post('/bailout/:walletAddress/:familyMemberAddress', async (req, res) => {
    const { walletAddress, familyMemberAddress } = req.params;

    try {
        const player = await Player.findOne({ walletAddress });
        const familyMember = await Player.findOne({ walletAddress: familyMemberAddress });

        if (!player || !familyMember) {
            return res.status(404).json({ message: 'Player or family member not found' });
        }

        console.log(`Player family ID: ${player.family}`);
        console.log(`Family member family ID: ${familyMember.family}`);

        // Ensure both players are in the same family
        if (String(player.family) !== String(familyMember.family)) {
            return res.status(403).json({ message: 'Can only bail out family members' });
        }

        if (!familyMember.jail?.isInJail) {
            return res.status(400).json({ message: 'Family member is not in jail' });
        }

        // Set a fixed bailout cost of 200 money
        const bailoutCost = 200;

        if (player.money < bailoutCost) {
            return res.status(400).json({ message: 'Insufficient funds to bail out family member' });
        }

        // Deduct fixed bailout cost and release family member
        player.money -= bailoutCost;
        familyMember.jail.isInJail = false;
        familyMember.jail.jailReleaseTime = null;

        await player.save();
        await familyMember.save();

        res.status(200).json({
            message: `Successfully bailed out ${familyMember.username}`,
            remainingMoney: player.money,
        });
    } catch (error) {
        console.error('Error bailing out family member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



// Protected Routes with jailCheck middleware
router.post('/smuggle/:walletAddress', jailCheck, async (req, res) => {
    res.json({ message: 'Smuggling attempt processed.' });
    await updatePlayerRank(player);

});

router.post('/steal-car/:walletAddress', jailCheck, async (req, res) => {
    res.json({ message: 'Steal car attempt processed.' });
    await updatePlayerRank(player);

});

router.post('/commit-crime/:walletAddress', jailCheck, async (req, res) => {
    res.json({ message: 'Crime attempt processed.' });
    await updatePlayerRank(player);

});

// Route to add items to inventory after a successful crime or car theft
router.post('/add-item', async (req, res) => {
    const { walletAddress, item } = req.body;

    console.log("Received item to add:", item); // Log item details on the server side
    console.log("Received walletAddress:", walletAddress); // Log wallet address

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) return res.status(404).json({ message: 'Player not found' });

        // Add item to inventory or update quantity if it already exists
        const existingItem = player.inventory.find(i => i.itemName === item.name);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            player.inventory.push({ itemName: item.name, quantity: 1, value: item.value, xp: item.xp });
        }

        player.money += item.value;
        player.points += item.xp;

        await player.save();
        console.log("Updated player inventory:", player.inventory); // Log updated inventory
        res.status(200).json({ message: 'Item added to inventory', inventory: player.inventory });
    } catch (error) {
        console.error('Error updating inventory:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// GET - Retrieve inventory by walletAddress
router.get('/inventory/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ message: 'Wallet address is required' });
    }

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) {
            console.log(`Player with walletAddress ${walletAddress} not found.`);
            return res.status(404).json({ message: 'Player not found' });
        }

        // Send the inventory or an empty array if none exists
        res.status(200).json({ inventory: player.inventory || [], money: player.money });
    } catch (error) {
        console.error('Error fetching player inventory:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

/* Helper function to update player and send response
const updatePlayer = async (walletAddress, updateData, res, successMessage) => {
    try {
        const player = await Player.findOneAndUpdate({ walletAddress }, updateData, { new: true });
        if (!player) return res.status(404).json({ message: 'Player not found' });
        res.status(200).json({ message: successMessage, player });
    } catch (error) {
        console.error('Error updating player:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}; */

// In your Express router file (e.g., routes/player.js)
router.post('/sell-item', async (req, res) => {
    const { walletAddress, itemName } = req.body;

    if (!walletAddress || !itemName) {
        return res.status(400).json({ message: 'Wallet address and item name are required.' });
    }

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) return res.status(404).json({ message: 'Player not found' });

        // Find the item in the inventory
        const itemIndex = player.inventory.findIndex(item => item.itemName === itemName);
        if (itemIndex === -1) return res.status(404).json({ message: 'Item not found in inventory' });

        const item = player.inventory[itemIndex];
        
        // Calculate total value based on quantity
        const totalValue = item.value * item.quantity;
        const totalXp = item.xp * item.quantity;

        // Update player's money and points
        player.money += totalValue;
        player.points += totalXp;

        // Remove the item from the inventory
        player.inventory.splice(itemIndex, 1);

        // Call the rank update function after modifying points
        await updatePlayerRank(player);

        await player.save();

        res.status(200).json({ inventory: player.inventory, money: player.money, points: player.points });
    } catch (error) {
        console.error('Error selling item:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.post('/sell-all-items', async (req, res) => {
    const { walletAddress, items } = req.body;

    if (!walletAddress || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Wallet address and items are required.' });
    }

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) return res.status(404).json({ message: 'Player not found' });

        let totalValue = 0;
        let totalXp = 0;

        // Loop through each item in the request and process it
        for (const itemData of items) {
            const { itemName, quantity } = itemData;
            
            // Find the item in the player's inventory
            const itemIndex = player.inventory.findIndex(item => item.itemName === itemName);
            if (itemIndex === -1) continue; // Skip if the item doesn't exist in inventory

            const item = player.inventory[itemIndex];

            // Ensure that we don't try to sell more than the available quantity
            const sellQuantity = Math.min(item.quantity, quantity);

            // Calculate the value and XP for the item
            totalValue += item.value * sellQuantity;
            totalXp += item.xp * sellQuantity;

            // Update the inventory: subtract the sold quantity
            player.inventory[itemIndex].quantity -= sellQuantity;

            // If the quantity reaches zero, remove the item from inventory
            if (player.inventory[itemIndex].quantity <= 0) {
                player.inventory.splice(itemIndex, 1);
            }
        }

        // Update player's money and points
        player.money += totalValue;
        player.points += totalXp;

        // Call the rank update function after modifying points
        await updatePlayerRank(player);

        await player.save();

        res.status(200).json({ inventory: player.inventory, money: player.money, points: player.points });
    } catch (error) {
        console.error('Error selling all items:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST - Log Minigame Score and Apply Rewards
router.post('/minigame/log', async (req, res) => {
    const { walletAddress, gameType, score } = req.body;
    if (!walletAddress || !gameType || typeof score !== 'number') return res.status(400).json({ message: 'Wallet address, game type, and score are required.' });

    try {
        const reward = calculateRewards(score);

        const newGame = new Game({ walletAddress, gameType, score, reward });
        await newGame.save();

        const player = await Player.findOne({ walletAddress });
        if (!player) return res.status(404).json({ message: 'Player not found' });

        player.money += reward.money;
        player.points += reward.xp;

        if (reward.item) {
            const existingItem = player.inventory.find(i => i.itemName === reward.item);
            if (existingItem) existingItem.quantity += 1;
            else player.inventory.push({ itemName: reward.item, quantity: 1, value: reward.money, xp: reward.xp });
        }

        await player.save();
        await updatePlayerRank(player); // Update player rank

        res.status(201).json({ message: 'Game score logged successfully', reward, playerMoney: player.money, playerPoints: player.points });
    } catch (error) {
        console.error('Error logging game score:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Helper function to calculate rewards based on score
const calculateRewards = (score) => {
    const xp = score * 10;
    const money = score * 5;
    const item = score > 80 ? 'Golden Watch' : null;

    return { xp, money, item };
};

// Route to fetch all eligible players (not in jail)
// GET - Fetch all players
router.get('/players', async (req, res) => {
    try {
        const players = await Player.find()
            .populate('family', 'name') // Haal alleen de naam van de familie op
            .select('username points rank family jail'); // Beperk opgehaalde velden

        const formattedPlayers = players.map(player => ({
            _id: player._id,
            username: player.username,
            points: player.points,
            rank: player.rank,
            family: player.family ? player.family.name : null, // Gebruik familienaam
            jail: player.jail,
        }));

        res.status(200).json(formattedPlayers);
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ message: 'Failed to fetch players' });
    }
});




router.get('/:userId', async (req, res) => {
    try {
        const player = await Player.findById(req.params.userId, 'inbox');
        
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const messages = player.inbox.sort((a, b) => b.timestamp - a.timestamp);
        res.json(messages);
    } catch (error) {
        console.error('Error fetching inbox messages:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Inside playerRoutes.js

// Define your routes here

// Helper function to calculate bailout cost based on jail time
const calculateBailoutCost = (player) => {
    const timeLeftInMinutes = Math.ceil((new Date(player.jail.jailReleaseTime) - Date.now()) / 60000);
    return timeLeftInMinutes * 50;
};


// Bestaande route voor ophalen op basis van ObjectId
router.get('/:id', async (req, res) => {
    try {
        const player = await Player.findById(req.params.id);
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }
        res.status(200).json(player);
    } catch (error) {
        console.error("Error fetching player by ID:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Nieuwe route om speler op basis van gebruikersnaam op te halen
router.get('/by-username/:username', async (req, res) => {
    try {
        const player = await Player.findOne({ username: req.params.username });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }
        res.status(200).json(player);
    } catch (error) {
        console.error("Error fetching player by username:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.post('/update-guide-status/:walletAddress', async (req, res) => {
    const { hasSeenGuide } = req.body; // Alleen hasSeenGuide komt uit de body
    const { walletAddress } = req.params; // WalletAddress uit de URL
  
    console.log('Incoming request:', { walletAddress, hasSeenGuide }); // Debug
  
    try {
      // Zoek de speler
      const user = await Player.findOneAndUpdate(
        { walletAddress },  // Zoeken op walletAddress
        { hasSeenGuide },  // Werk de 'hasSeenGuide' status bij
        { new: true }  // Stuur het nieuwe document terug
      );
  
      if (!user) {
        console.log('No user found with walletAddress:', walletAddress);
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Verstuur status via Socket.IO (optioneel)
      req.app.get('io').emit('guideStatusUpdated', { walletAddress, hasSeenGuide });
  
      console.log('Updated user:', user); // Debug de bijgewerkte gebruiker
      res.status(200).json(user); // Stuur de bijgewerkte speler terug
    } catch (error) {
      console.error('Error updating guide status:', error);
      res.status(500).json({ message: 'Error updating guide status', error });
    }
  });
  
  



router.get('/check-guide-status/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;  // Gebruik req.params om de walletAddress uit de URL te halen

    // Log de ontvangen walletAddress
    console.log('Received walletAddress:', walletAddress);

    try {
        // Controleer of walletAddress is aanwezig
        if (!walletAddress) {
            return res.status(400).json({ message: 'walletAddress is required' });
        }

        // Zoek de speler op basis van walletAddress
        const user = await Player.findOne({ walletAddress });

        // Als de speler niet gevonden wordt, log dat dan
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        // Log de gevonden speler
        console.log('User found:', user);

        // Stuur de hasSeenGuide status terug
        res.status(200).json({ hasSeenGuide: user.hasSeenGuide });
    } catch (error) {
        // Log de foutmelding als iets misgaat
        console.error('Error fetching guide status:', error);
        res.status(500).json({ message: 'Error fetching guide status', error });
    }
});

// Route om het saldo van de speler op te halen
router.get('/bankvault/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    try {
        // Haal de speler op uit de database met de juiste walletAddress
        const player = await Player.findOne({ walletAddress });

        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        // Bereken de rente
        const interest = player.calculateInterest();

        // Zorg ervoor dat depositDate altijd een geldig Date object is
        let depositDateString = 'No deposit yet';  // Default value

        if (player.depositDate) {
            // Controleer of depositDate een geldig Date object is
            const depositDate = new Date(player.depositDate);
            if (!isNaN(depositDate.getTime())) {
                depositDateString = depositDate.toLocaleDateString();
            }
        }

        res.json({
            balance: player.money, // Gebruik money in plaats van balance
            interest: interest,
            depositDate: depositDateString,  // De veilige datumstring
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route om het saldo bij te werken (deposit of withdraw)
router.put('/bankvault/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    const { depositAmount, withdrawAmount } = req.body;

    try {
      // Zoek de speler in de database met walletAddress
      let player = await Player.findOne({ walletAddress });

      if (!player) {
        // Maak een nieuwe speler aan als deze niet bestaat
        player = new Player({ walletAddress });
      }

      // Verwerk de storting
      if (depositAmount) {
        // Voeg het deposit bedrag toe aan het saldo (money)
        player.money += depositAmount;
        // Stel de deposit datum in
        player.depositDate = new Date();
      }

      // Verwerk de opname
      if (withdrawAmount) {
        if (withdrawAmount <= player.money) {
          // Trek het withdraw bedrag af van het saldo (money)
          player.money -= withdrawAmount;
        } else {
          return res.status(400).json({ error: 'Insufficient funds' });
        }
      }

      // Sla de speler op in de database
      await player.save();

      // Recalculeer de rente na de update
      const interest = player.calculateInterest();

      res.json({
        success: true,
        balance: player.money, // Geef het bijgewerkte saldo terug
        interest: interest,    // Geef de rente terug
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


module.exports = router;
