const express = require('express');
const router = express.Router();
const Message = require('../models/messages');
const Chat = require('../models/Chat'); // Import the Chat model

// Exporteer een functie die `io` accepteert
module.exports = (io) => {
  router.post('/send', async (req, res) => {
    const { chatId, senderId, content } = req.body;
    try {
        // Sla het nieuwe bericht op
        const newMessage = new Message({ chatId, senderId, content });
        await newMessage.save();

        // Populeer de `senderId` om de gebruikersnaam van de afzender op te halen
        const populatedMessage = await Message.findById(newMessage._id).populate('senderId', 'username');

        // Update de laatste berichtgegevens in de chat
        await Chat.findByIdAndUpdate(chatId, { lastMessage: content, lastMessageTime: Date.now() });

        // Emit het gepopuleerde bericht via Socket.io
        if (io) {
            io.to(chatId.toString()).emit('newMessage', populatedMessage);
        } else {
            console.error("Socket.io instance not found");
        }

        // Stuur het gepopuleerde bericht terug als API-respons
        res.status(200).json(populatedMessage);
    } catch (error) {
        console.error("Error in sendMessage route:", error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

    // Haal berichten op voor een specifieke chat
    router.get('/chat/:chatId', async (req, res) => {
        try {
            const messages = await Message.find({ chatId: req.params.chatId })
                .sort({ timestamp: 1 })
                .populate('senderId', 'username'); // Populate senderId with username

            res.status(200).json(messages);
        } catch (error) {
            console.error('Error fetching messages for chat:', error);
            res.status(500).json({ error: 'Failed to fetch messages for chat' });
        }
    });

    // Haal alle berichten op van een gebruiker
    router.get('/:userId', async (req, res) => {
        try {
            const messages = await Message.find({
                $or: [{ senderId: req.params.userId }, { receiverId: req.params.userId }]
            }).sort({ timestamp: -1 });

            res.status(200).json(messages);
        } catch (error) {
            console.error("Error fetching messages for user:", error);
            res.status(500).json({ error: 'Failed to fetch messages' });
        }
    });

    // Route om ongelezen berichten te krijgen
    router.get('/unread/:userId', async (req, res) => {
        const { userId } = req.params;
    
        console.log('Fetching unread messages for userId:', userId); // Log userId
    
        try {
            // Tellen van ongelezen berichten op basis van userId en isRead
            const unreadCount = await Message.countDocuments({
                senderId: { $ne: userId }, // Berichten die de gebruiker niet zelf heeft verzonden
                isRead: false, // Alleen ongelezen berichten
            });
    
            console.log('Unread count from DB:', unreadCount); // Debug log
            res.status(200).json({ unreadCount });
        } catch (error) {
            console.error('Error fetching unread messages:', error);
            res.status(500).json({ message: 'Failed to fetch unread messages' });
        }
    });
    
    

    // Markeer berichten als gelezen
    router.post('/mark-read', async (req, res) => {
        const { chatId, userId } = req.body;
    
        // Validatie van input
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
    
        try {
            // Query om berichten te vinden en bij te werken
            const query = {
                isRead: false, // Alleen ongelezen berichten
                senderId: { $ne: userId }, // Niet de afzender
            };
    
            if (chatId) {
                query.chatId = chatId; // Voeg chatId toe als het is opgegeven
            }
    
            const result = await Message.updateMany(query, { $set: { isRead: true } });
    
            console.log(`${result.modifiedCount} messages marked as read.`);
            res.status(200).json({
                message: `${result.modifiedCount} message(s) marked as read`,
            });
        } catch (error) {
            console.error('Error marking messages as read:', error);
            res.status(500).json({ error: 'Failed to mark messages as read' });
        }
    });
    
    

    return router; // Zorg ervoor dat je de router retourneert
};
