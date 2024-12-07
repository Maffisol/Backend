const mongoose = require('mongoose');
const Mission = require('../models/mission'); // Zorg dat het pad klopt
require('dotenv').config(); // Zorg dat je .env wordt geladen

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const seedMissions = async () => {
    const missions = [
        {
            title: 'Rescue the Don',
            description: 'The Don has been kidnapped. Get him back safely.',
            reward: 500,
            difficulty: 'Hard'
        },
        {
            title: 'Infiltrate the Rival Gang',
            description: 'Gain intel from the rival gang without being detected.',
            reward: 200,
            difficulty: 'Medium'
        },
        {
            title: 'Deliver the Package',
            description: 'Deliver a secret package to a secure location without being caught.',
            reward: 100,
            difficulty: 'Easy'
        },
        {
            title: 'Escape the Police',
            description: 'You are being chased by the police. Escape without getting caught.',
            reward: 300,
            difficulty: 'Medium'
        },
        {
            title: 'Assassinate the Rival Boss',
            description: 'Eliminate the leader of a rival gang without leaving any trace.',
            reward: 700,
            difficulty: 'Hard'
        },
        {
            title: 'Sabotage the Enemy\'s Operations',
            description: 'Disrupt the rival gang\'s operations without getting detected.',
            reward: 400,
            difficulty: 'Medium'
        },
        {
            title: 'Recruit New Members',
            description: 'Recruit new members for the family without attracting too much attention.',
            reward: 150,
            difficulty: 'Easy'
        },
        {
            title: 'Steal the Police Files',
            description: 'Break into the police station and steal confidential files on your family.',
            reward: 600,
            difficulty: 'Hard'
        }
    ];

    try {
        await Mission.insertMany(missions);
        console.log('Missions seeded successfully');
    } catch (err) {
        console.error('Error seeding missions:', err);
    } finally {
        mongoose.connection.close();
    }
};

seedMissions();
