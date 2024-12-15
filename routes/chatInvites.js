const express = require('express');
const router = express.Router();
const ChatInvite = require('../models/chatInvites');
const Message = require('../models/messages'); // Model voor berichten of chat-informatie
const Chat = require('../models/Chat'); // Add this line to import the Chat model

// Verstuur chat-uitnodiging
router.post('/send', async (req, res) => {
  const { inviterId, inviteeId } = req.body;
  try {
      const invite = new ChatInvite({ inviterId, inviteeId });
      await invite.save();
      res.status(200).json(invite);
  } catch (error) {
      res.status(500).json({ error: 'Failed to send invite' });
  }
});

// Haal alle chat-uitnodigingen op voor een specifieke gebruiker
router.get('/:userId', async (req, res) => {
  try {
      const invites = await ChatInvite.find({ inviteeId: req.params.userId });
      res.status(200).json(invites);
  } catch (error) {
      res.status(500).json({ error: 'Failed to fetch chat invites' });
  }
});

// Respond to a chat invite
router.post('/respond', async (req, res) => {
    const { inviteId, response } = req.body;

    if (!['accepted', 'declined'].includes(response)) {
        return res.status(400).json({ error: 'Invalid response value' });
    }

    try {
        const invite = await ChatInvite.findById(inviteId);
        if (!invite) return res.status(404).json({ error: 'Invite not found' });

        invite.status = response;
        await invite.save();

        if (response === 'accepted') {
            // Create or fetch existing chat between inviter and invitee
            let chat = await Chat.findOne({ participants: { $all: [invite.inviterId, invite.inviteeId] } });
            if (!chat) {
                chat = new Chat({ participants: [invite.inviterId, invite.inviteeId] });
                await chat.save();
            }

            res.status(200).json({ invite, newChat: chat });
        } else {
            res.status(200).json(invite);
        }
    } catch (error) {
        console.error("Error in respond route:", error);
        res.status(500).json({ error: 'Failed to respond to invite' });
    }
});


module.exports = router;
