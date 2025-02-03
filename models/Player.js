const mongoose = require('mongoose');

// Define an embedded schema for inbox messages with a unique _id for each message
const inboxMessageSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    messageType: { type: String, enum: ['invite', 'notification', 'message'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ['unread', 'read'], default: 'unread' }
});

// Define the main player schema
const playerSchema = new mongoose.Schema({
    walletAddress: { 
        type: String, 
        required: true, 
        unique: true,
        index: true,
        validate: {
            validator: function (v) {
                return /^[a-zA-Z0-9]{32,44}$/.test(v); 
            },
            message: props => `${props.value} is not a valid wallet address!`
        }
    },
    username: { 
        type: String, 
        unique: true, 
        index: true,
        minlength: 3,
        maxlength: 20,
        default: null
    },
    points: { type: Number, default: 0 },
    rank: { type: String, default: 'Rookie' },
    isPro: { type: Boolean, default: false },
    family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', default: null },
    createdAt: { type: Date, default: Date.now },
    hasSeenGuide: { type: Boolean, default: false },
    inbox: { type: [inboxMessageSchema], default: [] },
    base: {
        stage: { type: Number, default: 1 },
        expansions: {
            garage: { type: Number, default: 0 },
            weapons: { type: Number, default: 0 },
            cars: { type: Number, default: 0 }
        }
    },
    missions: {
        completedMissions: { type: Number, default: 0 },
        lastMissionDate: { type: Date, default: null },
        activeMission: {
            missionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mission', default: null },
            progress: { type: Number, default: 0 },
            reward: { type: Number, default: 0 }
        }
    },
    upgrades: [
        {
            upgradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUpgrade' },
            purchasedAt: { type: Date, default: Date.now }
        }
    ],
    money: { type: Number, default: 600 },
    lastOuncePurchase: { type: Date, default: null },
    ounces: { type: Number, default: 0 },
    halfKilos: { type: Number, default: 0 },
    kilos: { type: Number, default: 0 },
    bags: { type: Number, default: 0 },
    inventory: {
        type: [
            {
                itemName: String,
                quantity: { type: Number, default: 1 },
                value: Number,
                xp: Number,
            }
        ],
        default: []
    },
    jail: {
        isInJail: { type: Boolean, default: false },
        jailReleaseTime: { type: Date, default: null }
    },
    jailCount: { type: Number, default: 0 },

    // Bank vault-related fields
    balance: { type: Number, default: 0 }, // The player's current balance in the bank vault
    depositDate: { type: Date, default: null }, // The date the player made the deposit
    interest: { type: Number, default: 0 }, // The interest accrued on the deposited amount

}, { collection: 'players' });

// Define compound index for faster querying on username and walletAddress
playerSchema.index({ walletAddress: 1, username: 1 });

const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);
module.exports = Player;
