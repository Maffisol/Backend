const calculateSuccessChance = (successChance) => Math.random() * 100 < successChance;

const transferMoney = (attacker, target, percentage) => {
    const amount = Math.round(target.money * percentage);
    attacker.money += amount;
    target.money -= amount;
    return amount;
};

const transferItem = (attacker, target) => {
    const specialItem = target.inventory.find(item => item.isSpecial) || target.inventory[0];
    if (specialItem) {
        attacker.inventory.push(specialItem);
        target.inventory = target.inventory.filter(item => item._id !== specialItem._id);
        return specialItem;
    }
    return null;
};

const loseMoney = (player, percentage) => {
    const amount = Math.round(player.money * percentage);
    player.money -= amount;
    return amount;
};

const sendToJail = (player, durationHours) => {
    player.jail = {
        isInJail: true,
        jailReleaseTime: new Date(Date.now() + durationHours * 60 * 60 * 1000),
    };
};

const setCooldown = (player, durationHours) => {
    player.cooldown = new Date(Date.now() + durationHours * 60 * 60 * 1000);
};

module.exports = {
    calculateSuccessChance,
    transferMoney,
    transferItem,
    loseMoney,
    sendToJail,
    setCooldown,
};
