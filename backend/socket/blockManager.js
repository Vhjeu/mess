const blockedUsersByUser = new Map();

function getBlockedUsers(userId) {
    const normalizedUserId = Number(userId);
    return blockedUsersByUser.get(normalizedUserId) || new Set();
}

function addBlockedUser(userId, targetUserId) {
    const normalizedUserId = Number(userId);
    const normalizedTarget = Number(targetUserId);
    if (!normalizedTarget || normalizedTarget === normalizedUserId) return;

    const blocked = getBlockedUsers(normalizedUserId);
    blocked.add(normalizedTarget);
    blockedUsersByUser.set(normalizedUserId, blocked);
}

function removeBlockedUser(userId, targetUserId) {
    const normalizedUserId = Number(userId);
    const normalizedTarget = Number(targetUserId);
    if (!normalizedTarget || normalizedTarget === normalizedUserId) return;

    const blocked = getBlockedUsers(normalizedUserId);
    blocked.delete(normalizedTarget);
    if (blocked.size === 0) {
        blockedUsersByUser.delete(normalizedUserId);
    } else {
        blockedUsersByUser.set(normalizedUserId, blocked);
    }
}

function isBlockedBy(blockerId, senderId) {
    const normalizedBlockerId = Number(blockerId);
    return getBlockedUsers(normalizedBlockerId).has(Number(senderId));
}

module.exports = {
    getBlockedUsers,
    addBlockedUser,
    removeBlockedUser,
    isBlockedBy
};
