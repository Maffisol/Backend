const { checkJailStatus, startJailCountdown } = require('../helpers/jailHelper');

const jailCheck = async (req, res, next) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ message: 'Wallet address is required.' });
    }

    try {
        const jailStatus = await checkJailStatus(walletAddress);

        if (jailStatus.isInJail) {
            req.app.get('io').to(walletAddress).emit('jailStatusUpdated', jailStatus);

            if (jailStatus.jailReleaseTime) {
                startJailCountdown(req.app.get('io'), walletAddress, jailStatus.jailReleaseTime);
            }

            return res.status(403).json({
                message: 'Player is in jail.',
                jailReleaseTime: jailStatus.jailReleaseTime,
            });
        }

        next();
    } catch (error) {
        console.error('Error checking jail status:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = jailCheck;
