const mongoose = require('mongoose');
const BaseUpgrade = require('../models/baseUpgrade'); // Adjust the path as necessary
require('dotenv').config(); // Load environment variables from .env file

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('Connected to MongoDB');

        // Clear existing upgrades before seeding
        await BaseUpgrade.deleteMany({});

        // Define the initial upgrades
        const upgrades = [
            // Existing items
            {
                name: 'Audi RS8',
                type: 'car',
                cost: 100000,
                description: 'A luxury sports car with exceptional performance.',
                benefits: { strengthBoost: 10, speedBoost: 20 }
            },
            {
                name: 'Luxury Villa',
                type: 'house',
                cost: 500000,
                description: 'A large and luxurious home with a pool.',
                benefits: { strengthBoost: 0, speedBoost: 0 }
            },
            {
                name: 'High-End Weapon',
                type: 'weapon',
                cost: 25000,
                description: 'A weapon designed for precision and power.',
                benefits: { strengthBoost: 15 }
            },
            {
                name: 'Swimming Pool',
                type: 'pool',
                cost: 75000,
                description: 'A beautiful pool for relaxation.',
                benefits: { strengthBoost: 5 }
            },
            {
                name: 'Bullet Pack',
                type: 'bullet',
                cost: 500,
                description: 'A pack of high-quality bullets.',
                benefits: { strengthBoost: 2 }
            },

            // New items
            // Cars
            {
                name: 'Ferrari F12 Berlinetta',
                type: 'car',
                cost: 300000,
                description: 'An Italian supercar with a powerful V12 engine.',
                benefits: { speedBoost: 25, strengthBoost: 10 }
            },
            {
                name: 'Rolls Royce Phantom',
                type: 'car',
                cost: 400000,
                description: 'A luxurious sedan for the most refined mafia style.',
                benefits: { speedBoost: 15, strengthBoost: 5 }
            },
            {
                name: 'Lamborghini Aventador',
                type: 'car',
                cost: 350000,
                description: 'An iconic Italian sports car with impressive acceleration.',
                benefits: { speedBoost: 30, strengthBoost: 15 }
            },
            {
                name: 'BMW M8 Gran Coupe',
                type: 'car',
                cost: 150000,
                description: 'A sporty and powerful BMW with a luxury feel.',
                benefits: { speedBoost: 20, strengthBoost: 8 }
            },
            {
                name: 'Mercedes-Benz G-Class (G-Wagen)',
                type: 'car',
                cost: 250000,
                description: 'An iconic, robust SUV with an intimidating look.',
                benefits: { speedBoost: 10, strengthBoost: 20 }
            },

            // Houses
            {
                name: 'Penthouse in Dubai',
                type: 'house',
                cost: 1200000,
                description: 'A luxury penthouse with views of the Dubai skyline.',
                benefits: { strengthBoost: 0, speedBoost: 0 }
            },
            {
                name: 'Los Angeles Mansion',
                type: 'house',
                cost: 2500000,
                description: 'An expansive mansion with a pool and private cinema.',
                benefits: { strengthBoost: 5, speedBoost: 5 }
            },
            {
                name: 'Private Island',
                type: 'house',
                cost: 5000000,
                description: 'An exclusive island with a villa, beach, and landing strip.',
                benefits: { strengthBoost: 10, speedBoost: 10 }
            },
            {
                name: 'Mountain Cabin in the Alps',
                type: 'house',
                cost: 800000,
                description: 'A luxury chalet in the mountains for peace and privacy.',
                benefits: { strengthBoost: 3, speedBoost: 3 }
            },
            {
                name: 'High-Rise Condo in New York',
                type: 'house',
                cost: 1500000,
                description: 'A modern apartment overlooking the New York skyline.',
                benefits: { strengthBoost: 4, speedBoost: 4 }
            },

            // Weapons
            {
                name: 'Golden AK-47',
                type: 'weapon',
                cost: 45000,
                description: 'A gold-plated version of the iconic AK-47.',
                benefits: { strengthBoost: 20 }
            },
            {
                name: 'Silenced Pistol',
                type: 'weapon',
                cost: 15000,
                description: 'A silent pistol for discrete operations.',
                benefits: { strengthBoost: 10 }
            },
            {
                name: 'Sniper Rifle',
                type: 'weapon',
                cost: 30000,
                description: 'A powerful sniper rifle for long-range attacks.',
                benefits: { strengthBoost: 25 }
            },
            {
                name: 'Grenade Set',
                type: 'weapon',
                cost: 5000,
                description: 'A set of five grenades for tactical strikes.',
                benefits: { strengthBoost: 5 }
            },
            {
                name: 'Bulletproof Vest',
                type: 'weapon',
                cost: 20000,
                description: 'A protective vest to guard against bullets.',
                benefits: { defenseBoost: 15 }
            },

            // Luxury items
            {
                name: 'Private Jet',
                type: 'luxury',
                cost: 3000000,
                description: 'A private jet for fast travel and comfort.',
                benefits: { speedBoost: 50 }
            },
            {
                name: 'Yacht "The Prestige"',
                type: 'luxury',
                cost: 2500000,
                description: 'A luxury yacht with a jacuzzi and onboard bar.',
                benefits: { speedBoost: 10, strengthBoost: 10 }
            },
            {
                name: 'Rolex Collection',
                type: 'luxury',
                cost: 100000,
                description: 'A collection of the most exclusive Rolex watches.',
                benefits: { strengthBoost: 2 }
            },
            {
                name: 'Monalisa Reproduction',
                type: 'luxury',
                cost: 500000,
                description: 'A realistic reproduction of the Monalisa, a statement piece.',
                benefits: { strengthBoost: 1, defenseBoost: 1 }
            },
            {
                name: 'Private Security Team',
                type: 'luxury',
                cost: 200000,
                description: 'A team of personal bodyguards for your security.',
                benefits: { defenseBoost: 20 }
            }
        ];

        // Insert all upgrades into the database
        await BaseUpgrade.insertMany(upgrades);
        console.log('All upgrades added to the database.');

        mongoose.disconnect();
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
    });
