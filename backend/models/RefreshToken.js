const pool = require('../config/db');
const { randomUUID } = require('crypto');

class RefreshToken {
    static async create(userId) {
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày
        await pool.execute(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, token, expiresAt]
        );
        return token;
    }

    static async findByToken(token) {
        const [rows] = await pool.execute(
            'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
            [token]
        );
        return rows[0];
    }

    static async deleteByToken(token) {
        await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [token]);
    }

    static async deleteAllByUser(userId) {
        await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    }
}

module.exports = RefreshToken;
