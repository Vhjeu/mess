const pool = require('../config/db');
const { maskEmail } = require('../utils/accountSecurity');

const mapPublicUser = (row, { includeVerifiedEmail = false } = {}) => {
    if (!row) return undefined;

    const {
        email,
        pending_email: pendingEmail,
        email_verification_expires_at: verificationExpiresAt,
        email_verification_resend_available_at: resendAvailableAt,
        email_change_old_code_pending: oldEmailCodePending,
        email_change_old_expires_at: oldEmailCodeExpiresAt,
        email_change_old_resend_available_at: oldEmailResendAvailableAt,
        email_change_authorized_until: emailChangeAuthorizedUntil,
        ...publicRow
    } = row;

    const hasVerifiedEmail = Boolean(email && row.email_verified_at);
    const authorizationIsActive = Number(emailChangeAuthorizedUntil || 0) > Date.now();
    let emailChangeState = 'idle';
    if (hasVerifiedEmail && oldEmailCodePending) {
        emailChangeState = 'verify_current';
    } else if (hasVerifiedEmail && authorizationIsActive) {
        emailChangeState = pendingEmail ? 'verify_new' : 'enter_new';
    } else if (!hasVerifiedEmail && pendingEmail) {
        emailChangeState = 'verify_new';
    }

    const isVerifyingCurrentEmail = emailChangeState === 'verify_current';

    return {
        ...publicRow,
        ...(includeVerifiedEmail
            ? { email: hasVerifiedEmail ? email : null }
            : {}),
        display_name: row.display_name || row.username,
        display_name_updated_at: row.display_name_updated_at === null
            ? null
            : Number(row.display_name_updated_at),
        display_name_change_available_at: row.display_name_change_available_at === null
            ? null
            : Number(row.display_name_change_available_at),
        email_masked: maskEmail(email),
        pending_email_masked: maskEmail(pendingEmail),
        email_status: hasVerifiedEmail
            ? 'verified'
            : (pendingEmail ? 'pending' : 'missing'),
        email_change_state: emailChangeState,
        email_change_authorized_until: emailChangeAuthorizedUntil === null
            ? null
            : Number(emailChangeAuthorizedUntil),
        email_verified_at: row.email_verified_at === null
            ? null
            : Number(row.email_verified_at),
        email_verification_expires_at: (
            isVerifyingCurrentEmail ? oldEmailCodeExpiresAt : verificationExpiresAt
        ) === null
            ? null
            : Number(isVerifyingCurrentEmail ? oldEmailCodeExpiresAt : verificationExpiresAt),
        email_verification_resend_available_at: (
            isVerifyingCurrentEmail ? oldEmailResendAvailableAt : resendAvailableAt
        ) === null
            ? null
            : Number(isVerifyingCurrentEmail ? oldEmailResendAvailableAt : resendAvailableAt)
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
    async findById(id, options = {}) {
        const [rows] = await pool.execute(
            `SELECT
                id,
                username,
                display_name,
                avatar_url,
                created_at,
                email,
                pending_email,
                CAST(UNIX_TIMESTAMP(email_verified_at) * 1000 AS UNSIGNED)
                    AS email_verified_at,
                CAST(UNIX_TIMESTAMP(email_verification_expires_at) * 1000 AS UNSIGNED)
                    AS email_verification_expires_at,
                CAST(UNIX_TIMESTAMP(DATE_ADD(email_verification_sent_at, INTERVAL 60 SECOND)) * 1000 AS UNSIGNED)
                    AS email_verification_resend_available_at,
                (email_change_old_code_hash IS NOT NULL)
                    AS email_change_old_code_pending,
                CAST(UNIX_TIMESTAMP(email_change_old_expires_at) * 1000 AS UNSIGNED)
                    AS email_change_old_expires_at,
                CAST(UNIX_TIMESTAMP(DATE_ADD(email_change_old_sent_at, INTERVAL 60 SECOND)) * 1000 AS UNSIGNED)
                    AS email_change_old_resend_available_at,
                CAST(UNIX_TIMESTAMP(email_change_authorized_until) * 1000 AS UNSIGNED)
                    AS email_change_authorized_until,
                CAST(UNIX_TIMESTAMP(display_name_updated_at) * 1000 AS UNSIGNED)
                    AS display_name_updated_at,
                CAST(UNIX_TIMESTAMP(DATE_ADD(display_name_updated_at, INTERVAL 3 DAY)) * 1000 AS UNSIGNED)
                    AS display_name_change_available_at
             FROM users
             WHERE id = ?`,
            [id]
        );
        return mapPublicUser(rows[0], options);
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
        await pool.execute(
            `UPDATE users
             SET password_hash = ?,
                 password_reset_token_hash = NULL,
                 password_reset_expires_at = NULL
             WHERE id = ?`,
            [passwordHash, userId]
        );
    },

    // Lấy trạng thái online từ bảng online_users (sẽ dùng sau)
    async isOnline(userId) {
        const [rows] = await pool.execute('SELECT 1 FROM online_users WHERE user_id = ? LIMIT 1', [userId]);
        return rows.length > 0;
    }
};

module.exports = User;
