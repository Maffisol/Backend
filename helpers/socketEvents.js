const sendTerritoryUpdate = (io, territoryId, data) => {
    io.emit('territory-update', { territoryId, ...data });
};

const sendLeaderboardUpdate = (io, leaderboard) => {
    io.emit('leaderboard-update', leaderboard);
};

const sendFamilyUpdate = (io, familyId, data) => {
    io.to(`family-${familyId}`).emit('family-update', data);
};

module.exports = {
    sendTerritoryUpdate,
    sendLeaderboardUpdate,
    sendFamilyUpdate,
};