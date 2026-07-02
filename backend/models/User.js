const pool = require('../config/db');

const User = {
    async ensureDisplayNameColumn() {
        const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'display_name'");
        if (columns.length === 0) {
            await pool.execute('ALTER TABLE users ADD COLUMN display_name VARCHAR(100) DEFAULT NULL AFTER username');
        }
        await pool.execute('UPDATE users SET display_name = username WHERE display_name IS NULL');
    },

    async initialize() {
        await this.ensureDisplayNameColumn();
    },

    // Tạo user mới
    async create(username, passwordHash) {
        const [result] = await pool.execute(
            'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
            [username, passwordHash, username]
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
            'SELECT id, username, display_name, avatar_url, created_at FROM users WHERE id = ?',
            [id]
        );
        return rows[0];
    },

    async findByIdWithPassword(id) {
        const [rows] = await pool.execute(
            'SELECT id, username, display_name, avatar_url, password_hash FROM users WHERE id = ?',
            [id]
        );
        return rows[0];
    },

    // Lấy tất cả user (trừ bản thân, phục vụ tìm kiếm)
    async findAllExcept(userId, search = '') {
        let query = 'SELECT id, username, display_name, avatar_url FROM users WHERE id != ?';
        const params = [userId];
        if (search) {
            query += ' AND (username LIKE ? OR display_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        const [rows] = await pool.execute(query, params);
        return rows;
    },

    async updateUsername(userId, username) {
        await pool.execute('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
    },

    async updateDisplayName(userId, displayName) {
        await pool.execute('UPDATE users SET display_name = ? WHERE id = ?', [displayName, userId]);
    },

    // Cập nhật avatar
    async updateAvatar(userId, avatarUrl) {
        await pool.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
    },

    async updatePassword(userId, passwordHash) {
        await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    },

    // Lấy trạng thái online từ bảng online_users (sẽ dùng sau)
    async isOnline(userId) {
        const [rows] = await pool.execute('SELECT 1 FROM online_users WHERE user_id = ? LIMIT 1', [userId]);
        return rows.length > 0;
    }
};

module.exports = User;