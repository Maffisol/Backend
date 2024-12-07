const express = require('express');
const Mission = require('../models/mission'); // Zorg ervoor dat het pad klopt
const router = express.Router();

// Get all missions
router.get('/', async (req, res) => {
    try {
        const missions = await Mission.find();
        res.json(missions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create a new mission
router.post('/', async (req, res) => {
    const { title, description, reward, difficulty } = req.body;

    const mission = new Mission({
        title,
        description,
        reward,
        difficulty,
    });

    try {
        const newMission = await mission.save();
        res.status(201).json(newMission);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get a specific mission
router.get('/:id', async (req, res) => {
    try {
        const mission = await Mission.findById(req.params.id);
        if (mission == null) {
            return res.status(404).json({ message: 'Mission not found' });
        }
        res.json(mission);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update a mission
router.put('/:id', async (req, res) => {
    try {
        const mission = await Mission.findById(req.params.id);
        if (mission == null) {
            return res.status(404).json({ message: 'Mission not found' });
        }

        if (req.body.title != null) {
            mission.title = req.body.title;
        }
        if (req.body.description != null) {
            mission.description = req.body.description;
        }
        if (req.body.reward != null) {
            mission.reward = req.body.reward;
        }
        if (req.body.difficulty != null) {
            mission.difficulty = req.body.difficulty;
        }

        const updatedMission = await mission.save();
        res.json(updatedMission);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a mission
router.delete('/:id', async (req, res) => {
    try {
        const mission = await Mission.findById(req.params.id);
        if (mission == null) {
            return res.status(404).json({ message: 'Mission not found' });
        }

        await mission.remove();
        res.json({ message: 'Deleted Mission' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
