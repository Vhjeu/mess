const pool = require('../config/db');

const Nickname = {
    async initialize() {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS user_nicknames (
                owner_user_id INT NOT NULL,
                target_user_id INT NOT NULL,
                nickname VARCHAR(30) NOT NULL,
                updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                    ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (owner_user_id, target_user_id),
                CONSTRAINT fk_user_nicknames_owner
                    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_user_nicknames_target
                    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
    },

    async findAllByOwner(ownerUserId) {
        const [rows] = await pool.execute(
            `SELECT target_user_id, nickname
             FROM user_nicknames
             WHERE owner_user_id = ?`,
            [ownerUserId]
        );
        return rows;
    },

    async findOne(ownerUserId, targetUserId) {
        const [rows] = await pool.execute(
            `SELECT nickname
             FROM user_nicknames
             WHERE owner_user_id = ? AND target_user_id = ?`,
            [ownerUserId, targetUserId]
        );
        return rows[0]?.nickname || null;
    },

    async save(ownerUserId, targetUserId, nickname) {
        await pool.execute(
            `INSERT INTO user_nicknames (owner_user_id, target_user_id, nickname)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 nickname = VALUES(nickname),
                 updated_at = CURRENT_TIMESTAMP(6)`,
            [ownerUserId, targetUserId, nickname]
        );
    },

    async remove(ownerUserId, targetUserId) {
        await pool.execute(
            `DELETE FROM user_nicknames
             WHERE owner_user_id = ? AND target_user_id = ?`,
            [ownerUserId, targetUserId]
        );
    }
};

module.exports = Nickname;
