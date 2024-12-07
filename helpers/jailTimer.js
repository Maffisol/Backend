const dayjs = require('dayjs');
const Player = require('../models/Player');
const Notification = require('../models/notifications');

const activeCountdowns = new Set(); // Tracks active jail countdowns to prevent duplicates

const startJailCountdown = (io, walletAddress, releaseTime) => {
    const timeLeft = dayjs(releaseTime).diff(dayjs(), 'millisecond');

    if (timeLeft <= 0) {
        console.warn(`[startJailCountdown] Release time for ${walletAddress} is in the past.`);
        
        // Emit release event immediately if the release time is already in the past
        io.to(walletAddress).emit('jailStatusUpdated', {
            walletAddress,
            isInJail: false,
            jailReleaseTime: null,
        });
        return;
    }

    if (activeCountdowns.has(walletAddress)) {
        console.warn(`[startJailCountdown] Countdown already active for ${walletAddress}.`);
        return;
    }

    activeCountdowns.add(walletAddress);

    console.log(
        `[startJailCountdown] Countdown started for ${walletAddress}. Time left: ${timeLeft} ms. Release at: ${releaseTime}`
    );

    setTimeout(async () => {
        try {
            const player = await Player.findOne({ walletAddress });
            if (!player) {
                console.error(`[startJailCountdown] Player not found for wallet: ${walletAddress}`);
                return;
            }

            if (player.jail.isInJail) {
                // Update player jail status
                player.jail.isInJail = false;
                player.jail.jailReleaseTime = null;
                await player.save();

                console.log(`[startJailCountdown] Player ${walletAddress} jail status updated to released.`);

                // Check if a notification already exists to avoid duplicates
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
                    console.log(`[startJailCountdown] Release notification created for user: ${player._id}`);
                } else {
                    console.log(`[startJailCountdown] Release notification already exists for user: ${player._id}`);
                }

                // Emit jail release update to the frontend
                io.to(walletAddress).emit('jailStatusUpdated', {
                    walletAddress,
                    isInJail: false,
                    jailReleaseTime: null,
                });
                console.log(`[startJailCountdown] Emitted jail release for ${walletAddress}.`);
            } else {
                console.warn(
                    `[startJailCountdown] Player ${walletAddress} already marked as released. Skipping update.`
                );
            }
        } catch (error) {
            console.error(`[startJailCountdown] Error releasing player ${walletAddress}:`, error);
        } finally {
            // Remove the walletAddress from activeCountdowns to allow future countdowns
            activeCountdowns.delete(walletAddress);
            console.log(`[startJailCountdown] Countdown cleared for ${walletAddress}.`);
        }
    }, timeLeft);
};


module.exports = { startJailCountdown };
