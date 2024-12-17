const express = require('express');
const router = express.Router();
const FamilyInvite = require('../models/familyInvites');
const Player = require('../models/Player'); // Importing the Player model
const Family = require('../models/family'); // Importing the Family model

// Invite a member to the family (primary invite route)
router.post('/invite-member', async (req, res) => {
  const { inviterWalletAddress, inviteeUsername, familyId } = req.body;

  console.log("Received data in backend:", req.body); // Debug incoming data

  // Validate required fields
  if (!inviterWalletAddress || !inviteeUsername || !familyId) {
      console.error("Missing required fields in invite-member:", req.body);
      return res.status(400).json({ error: 'Missing required fields: inviterWalletAddress, inviteeUsername, or familyId' });
  }

  try {
      const inviter = await Player.findOne({ walletAddress: inviterWalletAddress });
      const invitee = await Player.findOne({ username: inviteeUsername });
      const family = await Family.findById(familyId);

      if (!inviter || !invitee || !family) {
          console.error("Invalid inviter, invitee, or family in invite-member:", { inviter, invitee, family });
          return res.status(404).json({ error: 'Inviter, Invitee, or Family not found' });
      }

      // Check if invitee is already in the family
      if (invitee.family && invitee.family.equals(family._id)) {
          console.error("Player is already in the family:", invitee);
          return res.status(400).json({ error: 'Player is already in the family' });
      }

      // Check for existing invite
      const existingInvite = await FamilyInvite.findOne({
          inviteeId: invitee._id,
          familyId: family._id,
          status: { $in: ['pending', 'accepted'] },
      });

      if (existingInvite) {
          console.error("Player already has a pending or accepted invite:", existingInvite);
          return res.status(400).json({ error: 'Player already has a pending or accepted invite to this family' });
      }

      // Create and save the invite
      const invite = new FamilyInvite({
          inviterId: inviter._id,
          inviteeId: invitee._id,
          familyId: family._id,
      });

      await invite.save();
      res.status(200).json({
          invite,
          inviterUsername: inviter.username,
          familyName: family.name,
      });
  } catch (error) {
      console.error("Error in invite-member route:", error);
      res.status(500).json({ error: 'Failed to send family invite' });
  }
});

// Fetch all pending family invites for a specific user (invitee)
// Fetch all pending family invites for a specific user (invitee)
router.get('/:userId', async (req, res) => {
  try {
    const invites = await FamilyInvite.find({ inviteeId: req.params.userId, status: 'pending' })
      .populate({ 
        path: 'inviterId', 
        model: 'Player', 
        select: 'username' 
      })
      .populate({ 
        path: 'familyId', 
        model: 'Family', 
        select: 'name' 
      });

    res.status(200).json(invites);
  } catch (error) {
    console.error("Error fetching invites:", error);
    res.status(500).json({ error: 'Failed to fetch family invites' });
  }
});


// Respond to family invite
// Respond to family invite
router.post('/respond', async (req, res) => {
  const { inviteId, response } = req.body;

  if (!['accepted', 'declined'].includes(response)) {
      return res.status(400).json({ error: 'Invalid response value' });
  }

  try {
      const invite = await FamilyInvite.findById(inviteId);
      if (!invite) return res.status(404).json({ error: 'Invite not found' });

      // Update the invite status
      invite.status = response;
      await invite.save();

      // If accepted, add invitee to the family
      if (response === 'accepted') {
          const invitee = await Player.findById(invite.inviteeId);
          const family = await Family.findById(invite.familyId);

          if (!invitee || !family) {
              return res.status(404).json({ error: 'Invitee or Family not found' });
          }

          // Update the invitee's family reference
          invitee.family = family._id;
          await invitee.save();

          // Add the invitee's username to the family's members array
          if (!family.members.includes(invitee.username)) {
              family.members.push(invitee.username);
              await family.save();
              console.log(`Added ${invitee.username} to family: ${family.name}`);
          }

          return res.status(200).json({ message: 'Invite accepted and member added to family', family });
      }

      res.status(200).json({ message: `Invite ${response}` });
  } catch (error) {
      console.error("Error responding to family invite:", error);
      res.status(500).json({ error: 'Failed to respond to family invite' });
  }
});


// Get all pending invites for a specific family
router.get('/:familyId/pending-invites', async (req, res) => {
  try {
    const pendingInvites = await FamilyInvite.find({ familyId: req.params.familyId, status: 'pending' })
    .populate('inviteeId', 'username walletAddress') // Add fields as needed
    .populate('familyId', 'name'); // Populate family name if necessary
  
    console.log("Fetched pending invites:", pendingInvites); // Log fetched invites
    
    res.status(200).json(pendingInvites);
  } catch (error) {
    console.error("Error fetching pending invites:", error);
    res.status(500).json({ error: 'Failed to fetch pending invites' });
  }
});


module.exports = router;
