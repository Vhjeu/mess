const crypto = require('crypto');
const pool = require('../config/db');

const EMAIL_COOLDOWN_MS = 60 * 1000;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_MAX_PER_WINDOW = 5;
const RESET_COOLDOWN_MS = 60 * 1000;
const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_MAX_PER_WINDOW = 3;

const createSecurityError = (code, message, retryAt = null) => {
    const error = new Error(message);
    error.code = code;
    error.retryAt = retryAt;
    return error;
};

const toTimestamp = value => (value ? new Date(value).getTime() : 0);

const evaluateRateLimit = ({
    sentAt,
    windowStartedAt,
    sendCount,
    cooldownMs,
    windowMs,
    maxPerWindow
}) => {
    const now = Date.now();
    const lastSentAt = toTimestamp(sentAt);
    if (lastSentAt && now - lastSentAt < cooldownMs) {
        throw createSecurityError(
            'SEND_COOLDOWN',
            'Vui lòng chờ trước khi gửi lại',
            lastSentAt + cooldownMs
        );
    }

    const currentWindowStartedAt = toTimestamp(windowStartedAt);
    const windowIsActive = currentWindowStartedAt && now - currentWindowStartedAt < windowMs;
    const nextWindowStartedAt = windowIsActive ? new Date(currentWindowStartedAt) : new Date(now);
    const currentCount = windowIsActive ? Number(sendCount || 0) : 0;

    if (currentCount >= maxPerWindow) {
        throw createSecurityError(
            'SEND_RATE_LIMIT',
            'Đã vượt quá số lần gửi cho phép',
            currentWindowStartedAt + windowMs
        );
    }

    return {
        windowStartedAt: nextWindowStartedAt,
        sendCount: currentCount + 1,
        resendAvailableAt: now + cooldownMs
    };
};

const hashesMatch = (storedHash, candidateHash) => {
    if (!storedHash || !candidateHash) return false;
    const stored = Buffer.from(storedHash, 'hex');
    const candidate = Buffer.from(candidateHash, 'hex');
    return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
};

const AccountSecurity = {
    async ensureColumn(columnName, definition) {
        const [columns] = await pool.query(`SHOW COLUMNS FROM users LIKE '${columnName}'`);
        if (columns.length === 0) {
            await pool.execute(`ALTER TABLE users ADD COLUMN ${columnName} ${definition}`);
        }
    },

    async ensureIndexes() {
        const [emailIndexes] = await pool.query(
            "SHOW INDEX FROM users WHERE Key_name = 'uq_users_email'"
        );
        if (emailIndexes.length === 0) {
            await pool.execute('ALTER TABLE users ADD UNIQUE INDEX uq_users_email (email)');
        }

        const [pendingEmailIndexes] = await pool.query(
            "SHOW INDEX FROM users WHERE Key_name = 'uq_users_pending_email'"
        );
        if (pendingEmailIndexes.length === 0) {
            await pool.execute(
                'ALTER TABLE users ADD UNIQUE INDEX uq_users_pending_email (pending_email)'
            );
        }

        const [resetTokenIndexes] = await pool.query(
            "SHOW INDEX FROM users WHERE Key_name = 'idx_users_password_reset_token'"
        );
        if (resetTokenIndexes.length === 0) {
            await pool.execute(
                'ALTER TABLE users ADD INDEX idx_users_password_reset_token (password_reset_token_hash)'
            );
        }
    },

    async initialize() {
        await this.ensureColumn('email', 'VARCHAR(254) DEFAULT NULL');
        await this.ensureColumn('email_verified_at', 'DATETIME(6) DEFAULT NULL');
        await this.ensureColumn('pending_email', 'VARCHAR(254) DEFAULT NULL');
        await this.ensureColumn('email_verification_code_hash', 'CHAR(64) DEFAULT NULL');
        await this.ensureColumn('email_verification_expires_at', 'DATETIME(6) DEFAULT NULL');
        await this.ensureColumn('email_verification_sent_at', 'DATETIME(6) DEFAULT NULL');
        await this.ensureColumn('email_verification_window_started_at', 'DATETIME(6) DEFAULT NULL');
        await this.ensureColumn('email_verification_send_count', 'INT UNSIGNED NOT NULL DEFAULT 0');
        await this.ensureColumn('email_verification_attempts', 'INT UNSIGNED NOT NULL DEFAULT 0');
        await this.ensureColumn('password_reset_token_hash', 'CHAR(64) DEFAULT NULL');
        await this.ensureColumn('password_reset_expires_at', 'DATETIME(6) DEFAULT NULL');
        await this.ensureColumn('password_reset_sent_at', 'DATETIME(6) DEFAULT NULL');
        await this.ensureColumn('password_reset_window_started_at', 'DATETIME(6) DEFAULT NULL');
        await this.ensureColumn('password_reset_send_count', 'INT UNSIGNED NOT NULL DEFAULT 0');
        await this.ensureColumn('password_reset_used_at', 'DATETIME(6) DEFAULT NULL');
        await this.ensureIndexes();
    },

    async requestEmailVerification(userId, email, codeHash, expiresAt) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [users] = await connection.execute(
                `SELECT email, email_verified_at, pending_email,
                        email_verification_sent_at,
                        email_verification_window_started_at,
                        email_verification_send_count
                 FROM users
                 WHERE id = ?
                 FOR UPDATE`,
                [userId]
            );
            const user = users[0];
            if (!user) throw createSecurityError('USER_NOT_FOUND', 'Không tìm thấy người dùng');

            if (user.email_verified_at && user.email === email) {
                throw createSecurityError('EMAIL_ALREADY_VERIFIED', 'Email này đã được xác minh');
            }

            const [duplicates] = await connection.execute(
                `SELECT id
                 FROM users
                 WHERE id <> ? AND (email = ? OR pending_email = ?)
                 LIMIT 1
                 FOR UPDATE`,
                [userId, email, email]
            );
            if (duplicates.length) {
                throw createSecurityError('EMAIL_TAKEN', 'Email đã được sử dụng bởi tài khoản khác');
            }

            const rate = evaluateRateLimit({
                sentAt: user.email_verification_sent_at,
                windowStartedAt: user.email_verification_window_started_at,
                sendCount: user.email_verification_send_count,
                cooldownMs: EMAIL_COOLDOWN_MS,
                windowMs: EMAIL_WINDOW_MS,
                maxPerWindow: EMAIL_MAX_PER_WINDOW
            });

            await connection.execute(
                `UPDATE users
                 SET pending_email = ?,
                     email_verification_code_hash = ?,
                     email_verification_expires_at = ?,
                     email_verification_sent_at = CURRENT_TIMESTAMP(6),
                     email_verification_window_started_at = ?,
                     email_verification_send_count = ?,
                     email_verification_attempts = 0
                 WHERE id = ?`,
                [
                    email,
                    codeHash,
                    expiresAt,
                    rate.windowStartedAt,
                    rate.sendCount,
                    userId
                ]
            );

            await connection.commit();
            return { email, resendAvailableAt: rate.resendAvailableAt };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    async resendEmailVerification(userId, codeHash, expiresAt) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [users] = await connection.execute(
                `SELECT pending_email,
                        email_verification_sent_at,
                        email_verification_window_started_at,
                        email_verification_send_count
                 FROM users
                 WHERE id = ?
                 FOR UPDATE`,
                [userId]
            );
            const user = users[0];
            if (!user) throw createSecurityError('USER_NOT_FOUND', 'Không tìm thấy người dùng');
            if (!user.pending_email) {
                throw createSecurityError('NO_PENDING_EMAIL', 'Không có email đang chờ xác minh');
            }

            const rate = evaluateRateLimit({
                sentAt: user.email_verification_sent_at,
                windowStartedAt: user.email_verification_window_started_at,
                sendCount: user.email_verification_send_count,
                cooldownMs: EMAIL_COOLDOWN_MS,
                windowMs: EMAIL_WINDOW_MS,
                maxPerWindow: EMAIL_MAX_PER_WINDOW
            });

            await connection.execute(
                `UPDATE users
                 SET email_verification_code_hash = ?,
                     email_verification_expires_at = ?,
                     email_verification_sent_at = CURRENT_TIMESTAMP(6),
                     email_verification_window_started_at = ?,
                     email_verification_send_count = ?,
                     email_verification_attempts = 0
                 WHERE id = ?`,
                [codeHash, expiresAt, rate.windowStartedAt, rate.sendCount, userId]
            );

            await connection.commit();
            return {
                email: user.pending_email,
                resendAvailableAt: rate.resendAvailableAt
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    async cancelEmailVerificationSend(userId, codeHash) {
        await pool.execute(
            `UPDATE users
             SET email_verification_code_hash = NULL,
                 email_verification_expires_at = NULL,
                 email_verification_sent_at = NULL,
                 email_verification_send_count =
                    GREATEST(email_verification_send_count - 1, 0)
             WHERE id = ? AND email_verification_code_hash = ?`,
            [userId, codeHash]
        );
    },

    async verifyEmail(userId, candidateHash) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [users] = await connection.execute(
                `SELECT pending_email,
                        email_verification_code_hash,
                        email_verification_expires_at,
                        email_verification_attempts
                 FROM users
                 WHERE id = ?
                 FOR UPDATE`,
                [userId]
            );
            const user = users[0];
            if (!user?.pending_email || !user.email_verification_code_hash) {
                throw createSecurityError('INVALID_OTP', 'Mã xác minh không hợp lệ hoặc đã hết hạn');
            }

            if (toTimestamp(user.email_verification_expires_at) <= Date.now()) {
                await connection.execute(
                    `UPDATE users
                     SET email_verification_code_hash = NULL,
                         email_verification_expires_at = NULL,
                         email_verification_attempts = 0
                     WHERE id = ?`,
                    [userId]
                );
                await connection.commit();
                throw createSecurityError('OTP_EXPIRED', 'Mã xác minh đã hết hạn');
            }

            if (!hashesMatch(user.email_verification_code_hash, candidateHash)) {
                const attempts = Number(user.email_verification_attempts || 0) + 1;
                await connection.execute(
                    `UPDATE users
                     SET email_verification_attempts = ?,
                         email_verification_code_hash =
                            IF(? >= 5, NULL, email_verification_code_hash),
                         email_verification_expires_at =
                            IF(? >= 5, NULL, email_verification_expires_at)
                     WHERE id = ?`,
                    [attempts, attempts, attempts, userId]
                );
                await connection.commit();
                throw createSecurityError(
                    attempts >= 5 ? 'OTP_ATTEMPTS_EXCEEDED' : 'INVALID_OTP',
                    attempts >= 5
                        ? 'Mã đã bị vô hiệu hóa do nhập sai quá nhiều lần'
                        : 'Mã xác minh không hợp lệ'
                );
            }

            const [duplicates] = await connection.execute(
                'SELECT id FROM users WHERE id <> ? AND email = ? LIMIT 1 FOR UPDATE',
                [userId, user.pending_email]
            );
            if (duplicates.length) {
                throw createSecurityError('EMAIL_TAKEN', 'Email đã được sử dụng bởi tài khoản khác');
            }

            await connection.execute(
                `UPDATE users
                 SET email = pending_email,
                     email_verified_at = CURRENT_TIMESTAMP(6),
                     pending_email = NULL,
                     email_verification_code_hash = NULL,
                     email_verification_expires_at = NULL,
                     email_verification_sent_at = NULL,
                     email_verification_window_started_at = NULL,
                     email_verification_send_count = 0,
                     email_verification_attempts = 0,
                     password_reset_token_hash = NULL,
                     password_reset_expires_at = NULL
                 WHERE id = ?`,
                [userId]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    async findVerifiedAccount(identifier) {
        const [rows] = await pool.execute(
            `SELECT id, email
             FROM users
             WHERE (username = ? OR email = ?)
               AND email IS NOT NULL
               AND email_verified_at IS NOT NULL
             LIMIT 1`,
            [identifier, identifier.toLowerCase()]
        );
        const user = rows[0];
        return user?.email ? user : null;
    },

    async startPasswordReset(userId, tokenHash, expiresAt) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [users] = await connection.execute(
                `SELECT email, email_verified_at,
                        password_reset_sent_at,
                        password_reset_window_started_at,
                        password_reset_send_count
                 FROM users
                 WHERE id = ?
                 FOR UPDATE`,
                [userId]
            );
            const user = users[0];
            if (!user?.email || !user.email_verified_at) {
                await connection.rollback();
                return null;
            }

            let rate;
            try {
                rate = evaluateRateLimit({
                    sentAt: user.password_reset_sent_at,
                    windowStartedAt: user.password_reset_window_started_at,
                    sendCount: user.password_reset_send_count,
                    cooldownMs: RESET_COOLDOWN_MS,
                    windowMs: RESET_WINDOW_MS,
                    maxPerWindow: RESET_MAX_PER_WINDOW
                });
            } catch {
                await connection.rollback();
                return null;
            }

            await connection.execute(
                `UPDATE users
                 SET password_reset_token_hash = ?,
                     password_reset_expires_at = ?,
                     password_reset_sent_at = CURRENT_TIMESTAMP(6),
                     password_reset_window_started_at = ?,
                     password_reset_send_count = ?,
                     password_reset_used_at = NULL
                 WHERE id = ?`,
                [tokenHash, expiresAt, rate.windowStartedAt, rate.sendCount, userId]
            );
            await connection.commit();
            return { email: user.email, tokenHash };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    async cancelPasswordResetSend(userId, tokenHash) {
        await pool.execute(
            `UPDATE users
             SET password_reset_token_hash = NULL,
                 password_reset_expires_at = NULL,
                 password_reset_sent_at = NULL,
                 password_reset_send_count = GREATEST(password_reset_send_count - 1, 0)
             WHERE id = ? AND password_reset_token_hash = ?`,
            [userId, tokenHash]
        );
    },

    async consumePasswordReset(tokenHash, passwordHash) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [users] = await connection.execute(
                `SELECT id, password_reset_expires_at
                 FROM users
                 WHERE password_reset_token_hash = ?
                 LIMIT 1
                 FOR UPDATE`,
                [tokenHash]
            );
            const user = users[0];
            if (!user || toTimestamp(user.password_reset_expires_at) <= Date.now()) {
                if (user) {
                    await connection.execute(
                        `UPDATE users
                         SET password_reset_token_hash = NULL,
                             password_reset_expires_at = NULL
                         WHERE id = ?`,
                        [user.id]
                    );
                }
                await connection.commit();
                return false;
            }

            await connection.execute(
                `UPDATE users
                 SET password_hash = ?,
                     password_reset_token_hash = NULL,
                     password_reset_expires_at = NULL,
                     password_reset_sent_at = NULL,
                     password_reset_window_started_at = NULL,
                     password_reset_send_count = 0,
                     password_reset_used_at = CURRENT_TIMESTAMP(6)
                 WHERE id = ?`,
                [passwordHash, user.id]
            );
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
};

module.exports = AccountSecurity;
