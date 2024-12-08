const Player = require("../models/Player");
const { ChatRequest } = require('../models/chatMessage');
const { Chat } = require('../models/Chat');  // Add Chat model for storing chat data

// Fetch pending chat invites for a user
const getChatInvites = async (req, res) => {
    const { userId } = req.params;

    console.log(`Fetching chat invites for user: ${userId}`); // Log for debugging

    try {
        const pendingChatInvites = await ChatRequest.find({
            receiverId: userId,
            status: 'pending'
        }).populate('senderId', 'username');
        console.log('Pending chat invites:', pendingChatInvites); // Log for debugging
        res.status(200).json(pendingChatInvites);
    } catch (error) {
        console.error('Error fetching chat invites:', error);
        res.status(500).json({ message: 'Error fetching chat invites' });
    }
};

// Fetch chats for a user
const getChats = async (req, res) => {
    const { userId } = req.params;

    console.log(`Fetching chats for user: ${userId}`); // Log the userId for debugging

    try {
        const chats = await Chat.find({ userId }).populate('messages.senderId');
        console.log('Chats fetched:', chats); // Log the chats for debugging
        res.status(200).json(chats);
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ message: 'Error fetching chats' });
    }
};


// Send a message
const sendMessage = async (req, res) => {
    const { walletAddress } = req.params;
    const { senderId, messageType, content } = req.body;

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const newMessage = {
            senderId,
            messageType,
            content,
            status: 'unread',
            timestamp: new Date()
        };

        player.inbox.push(newMessage); // Add the message to the inbox
        await player.save();

        res.status(200).json({ message: 'Message sent successfully', player });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Error sending message' });
    }
};

const markMessageAsRead = async (req, res) => {
    const { walletAddress } = req.params;
    const { messageId } = req.body; // Assuming the message ID is passed in the body

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const message = player.inbox.id(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        message.status = 'read';
        await player.save();

        res.status(200).json({ message: 'Message marked as read', player });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ message: 'Error marking message as read' });
    }
};

// Get unread messages for a player
const getUnreadMessages = async (req, res) => {
    const { walletAddress } = req.params;

    try {
        const player = await Player.findOne({ walletAddress });
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const unreadMessages = player.inbox.filter(msg => msg.status === 'unread');
        res.status(200).json(unreadMessages);
    } catch (error) {
        console.error('Error fetching unread messages:', error);
        res.status(500).json({ message: 'Error fetching unread messages' });
    }
};

module.exports = {
    sendMessage,
    markMessageAsRead,
    getUnreadMessages,
    getChatInvites, // Export the function here
    getChats
};
