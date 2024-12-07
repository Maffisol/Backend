// models/chat.js
const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true }],
  lastMessage: { type: String, default: '' },
  lastMessageTime: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Chat', chatSchema);
