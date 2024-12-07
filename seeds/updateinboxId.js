const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Player = require('../models/player'); // Adjust the path if necessary

dotenv.config(); // Load environment variables

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('Connected to MongoDB');
        
        const players = await Player.find();
        
        for (const player of players) {
            let updated = false;
            player.inbox = player.inbox.map(message => {
                if (!message._id) {
                    message._id = new mongoose.Types.ObjectId(); // Add _id if missing
                    updated = true;
                }
                return message;
            });
            
            if (updated) {
                await player.save();
                console.log(`Updated inbox for player ${player.username}`);
            }
        }
        
        console.log('Inbox messages updated');
        mongoose.disconnect();
    })
    .catch(err => console.error('MongoDB connection error:', err));
