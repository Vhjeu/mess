const pool = require('../config/db');

const OnlineUser = {
    async initialize() {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS online_users (
                socket_id VARCHAR(255) NOT NULL PRIMARY KEY,
                user_id INT NOT NULL,
                INDEX idx_online_users_user_id (user_id)
            )
        `);
    },

    // Thêm user online
    async add(userId, socketId) {
        await pool.execute(
            `INSERT INTO online_users (user_id, socket_id)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
            [userId, socketId]
        );
    },

    // Xóa theo socketId (khi disconnect)
    async removeBySocketId(socketId) {
        await pool.execute('DELETE FROM online_users WHERE socket_id = ?', [socketId]);
    },

    // Xóa tất cả socket của một user (khi logout hoặc muốn xóa sạch)
    async removeAllByUserId(userId) {
        await pool.execute('DELETE FROM online_users WHERE user_id = ?', [userId]);
    },

    // Kiểm tra user có online không
    async isOnline(userId) {
        const [rows] = await pool.execute('SELECT 1 FROM online_users WHERE user_id = ? LIMIT 1', [userId]);
        return rows.length > 0;
    },

    async getOnlineUserIds() {
        const [rows] = await pool.execute(
            'SELECT DISTINCT user_id FROM online_users'
        );
        return rows.map(row => Number(row.user_id));
    },

    // Lấy danh sách socketId của một user (để emit cho nhiều tab)
    async getSocketIds(userId) {
        const [rows] = await pool.execute('SELECT socket_id FROM online_users WHERE user_id = ?', [userId]);
        return rows.map(r => r.socket_id);
    },

    // Lấy userId từ socketId (dùng khi disconnect)
    async getUserIdBySocket(socketId) {
        const [rows] = await pool.execute('SELECT user_id FROM online_users WHERE socket_id = ?', [socketId]);
        return rows.length > 0 ? rows[0].user_id : null;
    }
};

module.exports = OnlineUser;
