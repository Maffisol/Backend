// models/messages.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  content: { type: String, required: false },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
  type: { type: String, enum: ['chat', 'notification'], default: 'chat' },
});

module.exports = mongoose.model('Message', messageSchema);
