const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config(); 
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const cors = require('cors');
const { startJailCountdown } = require('./helpers/jailTimer');
const killRoutes = require('./routes/killRoutes'); // Import the new kill route
const Family = require('./models/family'); // Zorg ervoor dat dit pad correct is

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    }
});

// CORS Middleware
app.use(cors({
  origin: "*",  // Replace with your actual frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,  // Allow cookies if needed
}));


// Middleware
app.use(express.json());

// Log requests
app.use((req, res, next) => {
    console.log(`Request Method: ${req.method}, Request URL: ${req.url}`);
    next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { 
    useNewUrlParser: true, 
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Import Models
const Player = require('./models/Player'); 
const ChatInvite = require('./models/chatInvites'); 
const Chat = require('./models/Chat'); 
const Message = require('./models/messages');
const Notification = require('./models/notifications');

// Import Routes
const playerRoutes = require('./routes/playerRoutes');
const businessRoutes = require('./routes/businessRoutes');
const hitterRoutes = require('./routes/hitterRoutes');
const leaderboardRoutes = require('./routes/Leaderboard');
const familyRoutes = require('./routes/families');
const baseRoutes = require('./routes/baseUpgrades');
const missionRoutes = require('./routes/missionRoutes');
const messageRoutes = require('./routes/messages'); 
const chatInviteRoutes = require('./routes/chatInvites'); 
const familyInviteRoutes = require('./routes/familyInvites'); 
const notificationRoutes = require('./routes/notifications'); // Adjust path if necessary
const chatRoutes = require('./routes/chats'); 
const jailRoutes = require('./routes/jailRoutes');
const dashboardRoutes = require('./routes/familyDashboard'); // Pas het pad aan indien nodig
const shopRoutes = require('./routes/shopRoutes');

// User socket map for tracking connected users
const userSockets = {};

// Function to check and update jail status
const checkJailStatus = async (walletAddress) => {
    const player = await Player.findOne({ walletAddress });
    if (!player) return null;

    const currentTime = Date.now();
    const jailReleaseTime = player.jail?.jailReleaseTime
        ? new Date(player.jail.jailReleaseTime).getTime()
        : null;

    // Check if jail time has expired
    if (player.jail?.isInJail && jailReleaseTime && jailReleaseTime < currentTime) {
        player.jail.isInJail = false;
        player.jail.jailReleaseTime = null;
        await player.save();
    }

    // Return consistent data
    return {
        isInJail: player.jail?.isInJail || false,
        jailReleaseTime: player.jail?.isInJail ? player.jail.jailReleaseTime : null,
    };
};


// Socket.io configuration
io.on('connection', (socket) => {
    console.log('New client connected.');

    // Handle player registration
    socket.on('register', async (walletAddress) => {
        console.log(`Player registered with wallet: ${walletAddress}`);
        socket.join(walletAddress);

        // Add walletAddress to userSockets map
        if (!userSockets[walletAddress]) {
            userSockets[walletAddress] = socket.id;
        }

        // Check current jail status
        const jailStatus = await checkJailStatus(walletAddress);

        if (!jailStatus) {
            console.warn(`No jail status found for wallet: ${walletAddress}`);
            io.to(walletAddress).emit('jailStatusUpdated', {
                walletAddress,
                isInJail: false,
                jailReleaseTime: null,
            });
            return;
        }

        // Emit jail status and start countdown if necessary
        io.to(walletAddress).emit('jailStatusUpdated', jailStatus);

        if (jailStatus.isInJail && jailStatus.jailReleaseTime) {
            console.log(`[register] Starting countdown for ${walletAddress}`);
            startJailCountdown(io, walletAddress, jailStatus.jailReleaseTime);
        }
    });

    // Handle player joining family room
    socket.on('joinFamily', (familyId) => {
        console.log(`Player joined family room: family-${familyId}`);
        socket.join(`family-${familyId}`);
    });

    // Handle leaving family room
    socket.on('leaveFamily', (familyId) => {
        console.log(`Player left family room: family-${familyId}`);
        socket.leave(`family-${familyId}`);
    });

    // Handle sending chat invites
    socket.on('sendChatInvite', async (data) => {
        const { senderId, receiverId } = data;

        try {
            const receiver = await Player.findById(receiverId);
            if (!receiver) {
                return socket.emit('chatInviteError', { message: 'Player not found' });
            }

            const newInvite = new ChatInvite({
                inviterId: senderId,
                inviteeId: receiverId,
                status: 'pending',
            });

            await newInvite.save();
            console.log(`Chat invite sent from ${senderId} to ${receiverId}`);

            const receiverSocketId = userSockets[receiverId];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('newChatInvite', newInvite);
            }
        } catch (error) {
            console.error('Error sending chat invite:', error);
            socket.emit('chatInviteError', { message: 'Failed to send chat invite' });
        }
    });

    // Handle sending messages
    socket.on('sendMessage', async (data) => {
        const { chatId, senderId, content } = data;

        try {
            const newMessage = new Message({
                chatId,
                senderId,
                content,
                timestamp: new Date(),
            });

            await newMessage.save();

            // Emit the new message to all users in the chat room
            io.to(chatId).emit('newMessage', {
                ...newMessage.toObject(),
                senderId,
            });

            console.log(`Message sent to chat ${chatId} by ${senderId}`);
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Join a chat room
    socket.on('joinChat', (chatId) => {
        console.log(`User joined chat room: ${chatId}`);
        socket.join(chatId);
    });

    // Join a family room
    socket.on('joinFamilyRoom', (familyId) => {
        if (!familyId) {
            console.error('Family ID is required to join a family room');
            return;
        }
        socket.join(`family-${familyId}`);
        console.log(`User joined room: family-${familyId}`);
    });

    // Handle new family messages
    socket.on('familyMessage', async ({ familyId, sender, message }) => {
        if (!familyId || !sender || !message) {
            console.error('Invalid familyMessage data:', { familyId, sender, message });
            return;
        }

        try {
            const family = await Family.findById(familyId); // Zorg dat Family correct is geïmporteerd
            if (!family) {
                console.error('Family not found:', familyId);
                return;
            }

            const newMessage = {
                sender,
                message,
                timestamp: new Date(),
            };

            family.chatHistory.push(newMessage); // Voeg bericht toe aan chatHistory
            await family.save();

            io.to(`family-${familyId}`).emit('newFamilyMessage', newMessage); // Emit bericht naar kamer
            console.log(`Family message sent in room family-${familyId} by ${sender}`);
        } catch (error) {
            console.error('Error saving family message:', error);
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        for (const [userId, socketId] of Object.entries(userSockets)) {
            if (socketId === socket.id) {
                delete userSockets[userId];
                console.log(`User ${userId} disconnected`);
                break;
            }
        }
    });
});

app.set('io', io);

// Apply Routes
app.use('/api/player', playerRoutes);
app.use('/api/business', businessRoutes(io));
app.use('/api/hitter', hitterRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/baseupgrade', baseRoutes(io));
app.use('/api/missions', missionRoutes);
app.use('/api/messages', messageRoutes(io));
app.use('/api/chat-invites', chatInviteRoutes); 
app.use('/api/family-invites', familyInviteRoutes); 
app.use('/api/notifications', notificationRoutes); // Ensure notificationRoutes is imported
app.use('/api/chats', chatRoutes); 
app.use('/api/jail', jailRoutes(io));
app.use('/api/kill', killRoutes(io)); // New kill route
app.use('/api/familyDashboard', dashboardRoutes(io));
app.use('/api/shop', shopRoutes);

// 404 Error Handling Middleware
app.use((req, res, next) => {
    res.status(404).json({ message: 'Route not found' });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Server Error' });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
