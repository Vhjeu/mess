const pool = require('../config/db');

const User = {
    // Tạo user mới
    async create(username, passwordHash) {
        const [result] = await pool.execute(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            [username, passwordHash]
        );
        return result.insertId;
    },

    // Tìm user theo username
    async findByUsername(username) {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        return rows[0];
    },

    // Tìm user theo id
    async findById(id) {
        const [rows] = await pool.execute(
            'SELECT id, username, avatar_url, created_at FROM users WHERE id = ?',
            [id]
        );
        return rows[0];
    },

    // Lấy tất cả user (trừ bản thân, phục vụ tìm kiếm)
    async findAllExcept(userId, search = '') {
        let query = 'SELECT id, username, avatar_url FROM users WHERE id != ?';
        const params = [userId];
        if (search) {
            query += ' AND username LIKE ?';
            params.push(`%${search}%`);
        }
        const [rows] = await pool.execute(query, params);
        return rows;
    },

    // Cập nhật avatar
    async updateAvatar(userId, avatarUrl) {
        await pool.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
    },

    // Lấy trạng thái online từ bảng online_users (sẽ dùng sau)
    async isOnline(userId) {
        const [rows] = await pool.execute('SELECT 1 FROM online_users WHERE user_id = ? LIMIT 1', [userId]);
        return rows.length > 0;
    }
};

module.exports = User;