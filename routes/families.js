const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Family = require('../models/family');
const Player = require('../models/Player');


// Get all families with members' usernames by family ID
router.get('/', async (req, res) => {
    try {
        const families = await Family.find({}, { __v: 0 }).lean();

        const populatedFamilies = await Promise.all(
            families.map(async (family) => {
                const members = await Player.find({ family: family._id }, 'username').lean();
                return { ...family, members: members.map(member => member.username) };
            })
        );

        res.json(populatedFamilies);
    } catch (error) {
        console.error('Error fetching families:', error);
        res.status(500).json({ message: 'Error fetching families' });
    }
});

// Create a new family
router.post('/', async (req, res) => {
    const { name, ownerUsername } = req.body;

    if (!name || !ownerUsername) {
        return res.status(400).json({ message: 'Name and ownerUsername are required' });
    }

    try {
        const player = await Player.findOne({ username: ownerUsername });
        if (!player) {
            return res.status(404).json({ message: 'Player with this username not found' });
        }

        const existingFamily = await Family.findOne({ name, owner: ownerUsername });
        if (existingFamily) {
            return res.status(400).json({ message: 'Family with this name already exists' });
        }

        const family = new Family({ name, members: [ownerUsername], owner: ownerUsername });
        await family.save();

        player.family = family._id;
        await player.save();

        res.status(201).json(family);
    } catch (error) {
        console.error('Error creating family:', error);
        res.status(500).json({ message: 'Error creating family' });
    }
});

// Invite a member to the family
router.post('/invite-member', async (req, res) => {
    const { familyId, username } = req.body;

    if (!familyId || !username) {
        console.error("Missing familyId or username", { familyId, username });
        return res.status(400).json({ message: 'Family ID and username are required' });
    }

    try {
        // Check if the family exists
        const family = await Family.findById(familyId);
        if (!family) {
            console.error('Family not found:', familyId);
            return res.status(404).json({ message: 'Family not found' });
        }

        // Check if the player exists
        const player = await Player.findOne({ username });
        if (!player) {
            console.error('Player not found:', username);
            return res.status(404).json({ message: 'Player not found' });
        }

        // Ensure the player is not already in a family
        if (player.family) {
            console.error('Player is already in a family:', username);
            return res.status(400).json({ message: 'Player is already in a family' });
        }

        // Check if the player already has a pending invite
        const existingInvite = player.inbox.find(
            invite => invite.messageType === 'invite' && invite.senderId.toString() === familyId && invite.status === 'pending'
        );

        if (existingInvite) {
            console.error('Existing invite found for player:', username);
            return res.status(400).json({ message: 'Player already has a pending invite from this family' });
        }

        // Create and send the invite message
        const inviteMessage = {
            _id: new mongoose.Types.ObjectId(),
            senderId: familyId,
            messageType: 'invite',
            content: `You have been invited to join the family ${family.name}.`,
            timestamp: new Date(),
            status: 'pending'
        };

        // Add the invite to the player's inbox and save
        player.inbox.push(inviteMessage);
        await player.save();

        console.log('Invite sent successfully to:', username);

        res.status(200).json({ message: 'Invitation sent successfully', inviteMessage });
    } catch (error) {
        // Log the error details for debugging
        console.error('Error sending family invite:', error);
        res.status(500).json({ message: 'Error sending invite', error: error.message });
    }
});



// Accept invite and add player to both Player and Family collections
router.post('/accept-invite', async (req, res) => {
    const { messageId, userId } = req.body;

    if (!messageId) return res.status(400).json({ message: 'Message ID is required' });

    try {
        const player = await Player.findById(userId);
        if (!player) return res.status(404).json({ message: 'Player not found' });

        const messageIndex = player.inbox.findIndex(msg => msg._id && msg._id.toString() === messageId);
        if (messageIndex === -1) return res.status(404).json({ message: 'Invite not found' });

        const familyId = player.inbox[messageIndex].senderId;
        player.family = familyId;
        player.inbox.splice(messageIndex, 1);
        await player.save();

        const family = await Family.findById(familyId);
        if (!family) return res.status(404).json({ message: 'Family not found' });

        if (!family.members.includes(player.username)) {
            family.members.push(player.username);
            await family.save();
        }

        res.status(200).json({ message: 'Invite accepted, player added to family' });
    } catch (error) {
        console.error('Error accepting invite:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Decline invite
router.post('/decline-invite', async (req, res) => {
    const { messageId, userId } = req.body;

    if (!messageId) return res.status(400).json({ message: 'Message ID is required' });

    try {
        const player = await Player.findById(userId);
        if (!player) return res.status(404).json({ message: 'Player not found' });

        const messageIndex = player.inbox.findIndex(msg => msg._id && msg._id.toString() === messageId);
        if (messageIndex === -1) return res.status(404).json({ message: 'Invite not found' });

        player.inbox.splice(messageIndex, 1);
        await player.save();

        res.status(200).json({ message: 'Invite declined' });
    } catch (error) {
        console.error('Error declining invite:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Remove a member from a family
router.post('/remove-member', async (req, res) => {
    const { familyId, username } = req.body;

    if (!familyId || !username) {
        return res.status(400).json({ message: 'Family ID and username are required' });
    }

    try {
        const family = await Family.findById(familyId);
        if (!family) {
            return res.status(404).json({ message: 'Family not found' });
        }

        if (!family.members.includes(username)) {
            return res.status(400).json({ message: 'Member does not exist in this family' });
        }

        family.members = family.members.filter(member => member !== username);
        await family.save();

        const player = await Player.findOne({ username });
        if (player) {
            player.family = null;
            await player.save();
        }

        res.status(200).json(family);
    } catch (error) {
        console.error('Error removing member from family:', error);
        res.status(500).json({ message: 'Error removing member from family' });
    }
});

// Fetch pending invites for a specific family
router.get('/:familyId/pending-invites', async (req, res) => {
    try {
      console.log(`Fetching pending invites for family ID: ${req.params.familyId}`);
      
      const pendingInvites = await FamilyInvite.find({ familyId: req.params.familyId, status: 'pending' })
        .populate('inviteeId', 'username walletAddress') // Ensure inviteeId correctly references Player
        .populate('familyId', 'name'); // Optionally populate family details
  
      console.log("Fetched pending invites from database:", pendingInvites);
  
      if (!pendingInvites || pendingInvites.length === 0) {
        console.warn("No pending invites found for this family.");
      }
  
      res.status(200).json(pendingInvites);
    } catch (error) {
      console.error("Error fetching pending invites:", error);
      res.status(500).json({ error: 'Failed to fetch pending invites' });
    }
  });
  //////////////////////dashboard family fights////////////////////////////////////////////////////////////////////////


module.exports = router;
