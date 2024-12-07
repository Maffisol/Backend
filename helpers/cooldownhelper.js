const Family = require('../models/family');

/**
 * Check cooldown status for an action.
 * @param {String} familyId - ID of the family.
 * @param {String} action - Action to check (e.g., 'claim', 'sabotage', 'collect', 'upgrade').
 * @param {Number} duration - Cooldown duration in milliseconds.
 * @returns {Object} - Object containing `active` (boolean) and `remaining` (time in ms).
 */
const checkCooldown = async (familyId, action, duration) => {
    const family = await Family.findById(familyId);
    if (!family) throw new Error('Family not found');

    // Ensure cooldowns field exists
    if (!family.cooldowns) {
        family.cooldowns = {};
        await family.save(); // Save the update to persist the structure
    }

    const lastActionTime = family.cooldowns[action];
    const now = Date.now();

    if (!lastActionTime || now - new Date(lastActionTime).getTime() > duration) {
        return { active: false, remaining: 0 };
    }

    const remaining = duration - (now - new Date(lastActionTime).getTime());
    return { active: true, remaining };
};

/**
 * Set a cooldown for a specific action.
 * @param {String} familyId - ID of the family.
 * @param {String} action - Action to set cooldown for (e.g., 'claim', 'sabotage', 'collect', 'upgrade').
 * @param {Object} io - The Socket.IO instance for real-time updates.
 */
const setCooldown = async (familyId, action, io) => {
    const family = await Family.findById(familyId);
    if (!family) throw new Error('Family not found');

    // Ensure cooldowns field exists
    if (!family.cooldowns) {
        family.cooldowns = {};
    }

    family.cooldowns[action] = new Date();
    await family.save();

    // Emit cooldown update via Socket.IO
    if (io) {
        const cooldowns = {
            claim: await checkCooldown(familyId, 'claim', 300000),
            sabotage: await checkCooldown(familyId, 'sabotage', 600000),
            collect: await checkCooldown(familyId, 'collect', 86400000),
            upgrade: await checkCooldown(familyId, 'upgrade', 1200000),
        };

        io.to(`family-${familyId}`).emit('update-cooldowns', cooldowns);
    }
};

module.exports = { checkCooldown, setCooldown };
