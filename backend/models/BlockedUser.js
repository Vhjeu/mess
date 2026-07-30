const pool = require('../config/db');

const BlockedUser = {
    async initialize() {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS blocked_users (
                blocker_user_id INT NOT NULL,
                blocked_user_id INT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (blocker_user_id, blocked_user_id),
                CONSTRAINT fk_blocked_users_blocker
                    FOREIGN KEY (blocker_user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_blocked_users_blocked
                    FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
    },

    async findByBlocker(blockerUserId) {
        const [rows] = await pool.execute(
            `SELECT blocked_user_id
             FROM blocked_users
             WHERE blocker_user_id = ?`,
            [blockerUserId]
        );
        return rows.map(row => Number(row.blocked_user_id));
    },

    async add(blockerUserId, blockedUserId) {
        await pool.execute(
            `INSERT INTO blocked_users (blocker_user_id, blocked_user_id)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE blocker_user_id = VALUES(blocker_user_id)`,
            [blockerUserId, blockedUserId]
        );
    },

    async remove(blockerUserId, blockedUserId) {
        await pool.execute(
            `DELETE FROM blocked_users
             WHERE blocker_user_id = ? AND blocked_user_id = ?`,
            [blockerUserId, blockedUserId]
        );
    },

    async exists(blockerUserId, blockedUserId) {
        const [rows] = await pool.execute(
            `SELECT 1
             FROM blocked_users
             WHERE blocker_user_id = ? AND blocked_user_id = ?
             LIMIT 1`,
            [blockerUserId, blockedUserId]
        );
        return rows.length > 0;
    }
};

module.exports = BlockedUser;
