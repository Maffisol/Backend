const express = require('express');
const router = express.Router();
const Notification = require('../models/notifications');

// Haal notificaties op voor een specifieke gebruiker
router.get('/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
