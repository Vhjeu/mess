const pool = require('../config/db');

const mapPublicUser = (row) => {
    if (!row) return undefined;

    return {
        ...row,
        display_name: row.display_name || row.username,
        display_name_updated_at: row.display_name_updated_at === null
            ? null
            : Number(row.display_name_updated_at),
        display_name_change_available_at: row.display_name_change_available_at === null
            ? null
            : Number(row.display_name_change_available_at)
    };
};

const User = {
    async ensureDisplayNameColumn() {
        const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'display_name'");
        if (columns.length === 0) {
            await pool.execute('ALTER TABLE users ADD COLUMN display_name VARCHAR(100) DEFAULT NULL AFTER username');
        }
        await pool.execute(
            "UPDATE users SET display_name = username WHERE display_name IS NULL OR TRIM(display_name) = ''"
        );
    },

    async ensureDisplayNameUpdatedAtColumn() {
        const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'display_name_updated_at'");
        if (columns.length === 0) {
            await pool.execute(`
                ALTER TABLE users
                ADD COLUMN display_name_updated_at DATETIME(6) DEFAULT NULL AFTER display_name
            `);
        }
    },

    async initialize() {
        await this.ensureDisplayNameColumn();
        await this.ensureDisplayNameUpdatedAtColumn();
    },

    // Tạo user mới
    async create(username, displayName, passwordHash) {
        const [result] = await pool.execute(
            'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
            [username, passwordHash, displayName]
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
            `SELECT
                id,
                username,
                display_name,
                avatar_url,
                created_at,
                CAST(UNIX_TIMESTAMP(display_name_updated_at) * 1000 AS UNSIGNED)
                    AS display_name_updated_at,
                CAST(UNIX_TIMESTAMP(DATE_ADD(display_name_updated_at, INTERVAL 3 DAY)) * 1000 AS UNSIGNED)
                    AS display_name_change_available_at
             FROM users
             WHERE id = ?`,
            [id]
        );
        return mapPublicUser(rows[0]);
    },

    async findByIdWithPassword(id) {
        const [rows] = await pool.execute(
            'SELECT id, username, display_name, avatar_url, password_hash FROM users WHERE id = ?',
            [id]
        );
        return rows[0];
    },

    async findPublicById(id) {
        const [rows] = await pool.execute(
            `SELECT id, username, COALESCE(NULLIF(TRIM(display_name), ''), username) AS display_name, avatar_url
             FROM users
             WHERE id = ?`,
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

    async updateDisplayNameIfAllowed(userId, displayName) {
        const [result] = await pool.execute(
            `UPDATE users
             SET display_name = ?, display_name_updated_at = CURRENT_TIMESTAMP(6)
             WHERE id = ?
               AND (
                   display_name_updated_at IS NULL
                   OR display_name_updated_at <= DATE_SUB(CURRENT_TIMESTAMP(6), INTERVAL 3 DAY)
               )`,
            [displayName, userId]
        );
        return result.affectedRows > 0;
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
