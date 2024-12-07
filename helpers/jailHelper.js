const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const Player = require('../models/Player');

// Extending Day.js with plugins
dayjs.extend(utc);

/**
 * Sends a player to jail.
 */
const sendToJail = async (player, jailTime = 5) => {
    try {
        const rankDurations = {
            Rookie: 5,
            Associate: 10,
            Soldier: 20,
            Capo: 30,
            Underboss: 40,
            Don: 50,
            Godfather: 60,
        };

        // Bereken de gevangenistijd op basis van rang en strafgeschiedenis
        const baseJailTime = rankDurations[player.rank] || 5;
        const additionalTime = Math.min(player.jailCount * 2, 20); // Extra tijd gebaseerd op aantal eerdere straffen
        const totalJailTime = jailTime || baseJailTime + additionalTime;

        console.log(`Sending player ${player.username} (Rank: ${player.rank}) to jail for ${totalJailTime} minutes.`);

        // Update de gevangenisstatus in de database
        player.jail = {
            isInJail: true,
            jailReleaseTime: dayjs().add(totalJailTime, 'minute').toISOString(),
        };
        player.jailCount = (player.jailCount || 0) + 1;

        // Opslaan in de database
        await player.save();

        console.log(`Player ${player.username} jail status updated successfully:`, player.jail);
        return player.jail;
    } catch (error) {
        console.error(`Error sending player ${player.username} to jail:`, error);
        throw new Error('Failed to update player jail status.');
    }
};


/**
 * Checks a player's jail status and releases them if the time is over.
 */
const checkJailStatus = async (walletAddress) => {
    const player = await Player.findOne({ walletAddress });

    if (!player) {
        console.error(`Player with wallet ${walletAddress} not found.`);
        return { walletAddress, isInJail: false };
    }

    const releaseTime = dayjs(player.jail?.jailReleaseTime);
    if (releaseTime.isBefore(dayjs())) {
        player.jail.isInJail = false;
        player.jail.jailReleaseTime = null;
        await player.save();
        console.log(`Player ${walletAddress} released from jail.`);
        return { walletAddress, isInJail: false };
    }

    return { walletAddress, isInJail: true, jailReleaseTime: player.jail.jailReleaseTime };
};

/**
 * Starts a countdown to release a player from jail.
 */
const startJailCountdown = (io, walletAddress, jailReleaseTime) => {
    if (!jailReleaseTime) return;

    const remainingTime = new Date(jailReleaseTime).getTime() - Date.now();
    if (remainingTime <= 0) return;

    const interval = setInterval(async () => {
        const currentTime = Date.now();
        if (currentTime >= new Date(jailReleaseTime).getTime()) {
            const player = await Player.findOne({ walletAddress });
            if (player && player.jail?.isInJail) {
                player.jail.isInJail = false;
                player.jail.jailReleaseTime = null;
                await player.save();

                // Controleer of er al een notificatie bestaat
                const existingNotification = await Notification.findOne({
                    userId: player._id,
                    message: 'You have been released from jail.',
                });

                if (!existingNotification) {
                    const notification = new Notification({
                        userId: player._id,
                        message: 'You have been released from jail.',
                    });
                    await notification.save();
                    console.log(`Release notification created for user: ${player._id}`);
                } else {
                    console.log(`Release notification already exists for user: ${player._id}`);
                }

                // Emit de jail status update
                io.to(walletAddress).emit('jailStatusUpdated', {
                    walletAddress,
                    isInJail: false,
                    jailReleaseTime: null,
                });
                console.log(`Jail release status emitted for wallet: ${walletAddress}`);
            }
            clearInterval(interval);
        }
    }, 1000);
};

module.exports = { sendToJail, checkJailStatus, startJailCountdown };
