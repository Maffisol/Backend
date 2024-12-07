const express = require('express');
const Player = require('../models/Player'); // Pas het pad aan indien nodig
const Family = require('../models/family'); // Pas het pad aan indien nodig

const router = express.Router();

// Player leaderboard route
router.get('/players', async (req, res) => {
    try {
        // Zoek spelers en populate de family velden
        const players = await Player.find()
            .populate('family') // Populeert het family veld zodat het Family-document beschikbaar is
            .sort({ points: -1 })
            .limit(10);

        // Creëer een leaderboard array
        const leaderboard = players.map(player => ({
            walletAddress: player.walletAddress,
            username: player.username || player.walletAddress,
            points: player.points,
            family: player.family ? player.family.name : 'No Family', // Gebruik family.name als het bestaat
            rank: player.rank || 'Rookie',
            isPro: player.isPro || false,
        }));

        res.json(leaderboard);
    } catch (error) {
        console.error('Error fetching player leaderboard:', error.message);
        res.status(500).json({ message: 'Error fetching player leaderboard' });
    }
});

// Family leaderboard route
// Family leaderboard route
// Route voor familie-leaderboard
router.get('/families', async (req, res) => {
    try {
        const families = await Family.find();

        const familyLeaderboard = await Promise.all(
            families.map(async (family) => {
                let totalPoints = 0;

                // Bereken de totale punten van alle leden in de family
                await Promise.all(
                    family.members.map(async (member) => {
                        const player = await Player.findOne({ username: member });
                        if (player) {
                            totalPoints += player.points; // Voeg de punten van de speler toe
                        }
                    })
                );

                return {
                    familyName: family.name,
                    memberCount: family.members.length,
                    totalPoints, // Totaal aantal punten van spelers in de family
                    dominancePoints: family.dominancePoints || 0, // Dominance points van de family
                };
            })
        );

        // Sorteer op dominance points en gebruik total points als tie-breaker
        familyLeaderboard.sort((a, b) => {
            if (b.dominancePoints === a.dominancePoints) {
                return b.totalPoints - a.totalPoints;
            }
            return b.dominancePoints - a.dominancePoints;
        });

        res.status(200).json(familyLeaderboard);
    } catch (error) {
        console.error('Error fetching family leaderboard:', error);
        res.status(500).json({ message: 'Failed to fetch family leaderboard' });
    }
});



module.exports = router;
