const express = require('express');
const router = express.Router();
const Player = require('../models/Player'); // Zorg ervoor dat het pad naar je Player model correct is

module.exports = (io) => {
// Constants for prices
const OUNCE_PRICE = 600;
const HALF_KILO_PRICE = 2200; // Prijs voor een halve kilo
const KILO_PRICE = 4000; // Prijs voor een kilo
const BAG_PRICE = 10; // Prijs per zakje
const OUNCE_TO_BAGS = 125; // Aantal zakjes dat je krijgt per ons
const OUNCE_SELL_PRICE = 650; // Verkoopprijs voor een ons

// PUT to buy an ounce
router.put('/buyOunce/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    try {
        const player = await Player.findOne({ walletAddress });

        if (!player) {
            return res.status(404).json({ message: 'Speler niet gevonden' });
        }

        // Check if the player has enough money to buy an ounce
        if (player.money < OUNCE_PRICE) {
            return res.status(400).json({ message: 'Niet genoeg geld om een ons te kopen.' });
        }

        // Update player's money and inventory
        player.money -= OUNCE_PRICE; // Verlies $600
        player.ounces += 1; // Krijg 1 ons
        player.bags += OUNCE_TO_BAGS; // Krijg 125 zakjes voor de ounce
        player.lastOuncePurchase = new Date(); // Sla de tijd van de aankoop op
        await player.save();

        return res.json(player);
    } catch (error) {
        console.error('Fout bij het kopen van een ons:', error);
        return res.status(500).json({ message: 'Interne Server Fout' });
    }
});

// PUT to buy half kilo
router.put('/buyHalfKilo/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    try {
        const player = await Player.findOne({ walletAddress });

        if (!player) {
            return res.status(404).json({ message: 'Speler niet gevonden' });
        }

        // Check if the player has enough money
        if (player.money < HALF_KILO_PRICE) {
            return res.status(400).json({ message: 'Niet genoeg geld om een halve kilo te kopen.' });
        }

        // Update player's money and inventory
        player.money -= HALF_KILO_PRICE; // Verlies $2200
        player.halfKilos += 1; // Krijg 1 halve kilo
        await player.save();

        return res.json(player);
    } catch (error) {
        console.error('Fout bij het kopen van een halve kilo:', error);
        return res.status(500).json({ message: 'Interne Server Fout' });
    }
});

// PUT to buy kilo
router.put('/buyKilo/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    try {
        const player = await Player.findOne({ walletAddress });

        if (!player) {
            return res.status(404).json({ message: 'Speler niet gevonden' });
        }

        // Check if the player has enough money
        if (player.money < KILO_PRICE) {
            return res.status(400).json({ message: 'Niet genoeg geld om een kilo te kopen.' });
        }

        // Update player's money and inventory
        player.money -= KILO_PRICE; // Verlies $4000
        player.kilos += 1; // Krijg 1 kilo
        player.ounces += 10; // Krijg 10 ons
        await player.save();

        return res.json(player);
    } catch (error) {
        console.error('Fout bij het kopen van een kilo:', error);
        return res.status(500).json({ message: 'Interne Server Fout' });
    }
});

// PUT to sell bags
router.put('/sellBags/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    try {
        const player = await Player.findOne({ walletAddress });

        if (!player) {
            return res.status(404).json({ message: 'Speler niet gevonden' });
        }

        // Check if the player has bags to sell
        if (player.bags <= 0) {
            return res.status(400).json({ message: 'Geen zakjes om te verkopen.' });
        }

        // Update player's money and inventory
        player.bags -= 1; // Verkoop 1 zakje
        player.money += BAG_PRICE; // Verdien $10 van de verkoop
        await player.save();

        return res.json(player);
    } catch (error) {
        console.error('Fout bij het verkopen van zakjes:', error);
        return res.status(500).json({ message: 'Interne Server Fout' });
    }
});

// PUT to upgrade to half kilo
router.put('/upgradeToHalfKilo/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    try {
        const player = await Player.findOne({ walletAddress });

        if (!player) {
            return res.status(404).json({ message: 'Speler niet gevonden' });
        }

        // Check if the player has enough money
        if (player.money < HALF_KILO_PRICE) {
            return res.status(400).json({ message: 'Niet genoeg geld voor een halve kilo.' });
        }

        player.money -= HALF_KILO_PRICE; // Verlies $2200
        player.halfKilos += 1; // Krijg 1 halve kilo
        await player.save();

        return res.json(player);
    } catch (error) {
        console.error('Fout bij het upgraden naar halve kilo:', error);
        return res.status(500).json({ message: 'Interne Server Fout' });
    }
});

// PUT to upgrade to kilo
router.put('/upgradeToKilo/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    try {
        const player = await Player.findOne({ walletAddress });

        if (!player) {
            return res.status(404).json({ message: 'Speler niet gevonden' });
        }

        // Check if the player has enough money
        if (player.money < KILO_PRICE) {
            return res.status(400).json({ message: 'Niet genoeg geld voor een kilo.' });
        }

        player.money -= KILO_PRICE; // Verlies $4000
        player.kilos += 1; // Krijg 1 kilo
        await player.save();

        return res.json(player);
    } catch (error) {
        console.error('Fout bij het upgraden naar kilo:', error);
        return res.status(500).json({ message: 'Interne Server Fout' });
    }
});

// PUT to sell an ounce
router.put('/sellOunce/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    try {
        const player = await Player.findOne({ walletAddress });

        if (!player) {
            return res.status(404).json({ message: 'Speler niet gevonden' });
        }

        // Check if the player has ounces to sell
        if (player.ounces <= 0) {
            return res.status(400).json({ message: 'Geen ons om te verkopen.' });
        }

        // Update player's money and inventory
        player.ounces -= 1; // Verkoop 1 ons
        player.money += OUNCE_SELL_PRICE; // Verdien $650 van de verkoop
        await player.save();

        return res.json(player);
    } catch (error) {
        console.error('Fout bij het verkopen van een ons:', error);
        return res.status(500).json({ message: 'Interne Server Fout' });
    }
});

return router;
};
