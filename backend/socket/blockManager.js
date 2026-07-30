const BlockedUser = require('../models/BlockedUser');

async function getBlockedUsers(userId) {
    return new Set(await BlockedUser.findByBlocker(Number(userId)));
}

async function addBlockedUser(userId, targetUserId) {
    const normalizedUserId = Number(userId);
    const normalizedTarget = Number(targetUserId);
    if (!normalizedTarget || normalizedTarget === normalizedUserId) return false;

    await BlockedUser.add(normalizedUserId, normalizedTarget);
    return true;
}

async function removeBlockedUser(userId, targetUserId) {
    const normalizedUserId = Number(userId);
    const normalizedTarget = Number(targetUserId);
    if (!normalizedTarget || normalizedTarget === normalizedUserId) return false;

    await BlockedUser.remove(normalizedUserId, normalizedTarget);
    return true;
}

async function isBlockedBy(blockerId, senderId) {
    return BlockedUser.exists(Number(blockerId), Number(senderId));
}

module.exports = {
    getBlockedUsers,
    addBlockedUser,
    removeBlockedUser,
    isBlockedBy
};
