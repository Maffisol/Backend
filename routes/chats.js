const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/messages');
const Player = require('../models/Player'); // Import the Player model

// Haal alle chats van de gebruiker op met de laatste berichten
router.get('/:userId', async (req, res) => {
  try {
      const chats = await Chat.find({ participants: req.params.userId })
          .populate({
              path: 'participants',
              model: 'Player', // Use the Player model
              select: 'username'
          })
          .sort({ lastMessageTime: -1 });

      const chatData = await Promise.all(chats.map(async (chat) => {
          const lastMessage = await Message.findOne({ chatId: chat._id }).sort({ timestamp: -1 }).lean();
          const unreadCount = await Message.countDocuments({ chatId: chat._id, isRead: false, senderId: { $ne: req.params.userId } });
          return { ...chat.toObject(), lastMessage, unreadCount };
      }));

      res.status(200).json(chatData);
  } catch (error) {
      console.error("Error fetching chats:", error); // Log detailed error
      res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Chat aanmaken of ophalen
router.post('/create', async (req, res) => {
  const { userId1, userId2 } = req.body;
  try {
      let chat = await Chat.findOne({ participants: { $all: [userId1, userId2] } });
      if (!chat) {
          chat = new Chat({ participants: [userId1, userId2] });
          await chat.save();
      }
      res.status(200).json(chat);
  } catch (error) {
      console.error("Error creating or fetching chat:", error); // Log detailed error
      res.status(500).json({ error: 'Failed to create or fetch chat' });
  }
});

// Fetch messages for a specific chat
router.get('/chat/:chatId', async (req, res) => {
    try {
        const messages = await Message.find({ chatId: req.params.chatId })
            .sort({ timestamp: 1 }) // Sorteer op timestamp in oplopende volgorde
            .populate('senderId', 'username'); // Haal de `username` van de afzender op via populatie

        res.status(200).json(messages); // Stuur de berichten terug naar de frontend
    } catch (error) {
        console.error('Error fetching messages for chat:', error);
        res.status(500).json({ error: 'Failed to fetch messages for chat' });
    }
});

// Delete a chat
router.delete('/:chatId', async (req, res) => {
  try {
      await Message.deleteMany({ chatId: req.params.chatId });
      await Chat.findByIdAndDelete(req.params.chatId);
      res.status(200).json({ message: 'Chat deleted' });
  } catch (error) {
      console.error("Error deleting chat:", error); // Log detailed error
      res.status(500).json({ error: 'Failed to delete chat' });
  }
});

module.exports = router;
