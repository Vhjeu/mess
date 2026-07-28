const pool = require('../config/db');

const Message = {
    async initialize() {
        await Promise.all([
            this.ensureRevocationColumn(),
            this.ensureAttachmentMetadataColumns()
        ]);
    },

    async ensureRevocationColumn() {
        const [columns] = await pool.query("SHOW COLUMNS FROM messages LIKE 'is_revoked'");
        if (columns.length === 0) {
            await pool.execute("ALTER TABLE messages ADD COLUMN is_revoked BOOLEAN DEFAULT FALSE");
        }
    },

    async ensureAttachmentMetadataColumns() {
        const [nameColumns] = await pool.query("SHOW COLUMNS FROM attachments LIKE 'file_name'");
        if (nameColumns.length === 0) {
            await pool.execute("ALTER TABLE attachments ADD COLUMN file_name VARCHAR(255) DEFAULT NULL");
        }

        const [sizeColumns] = await pool.query("SHOW COLUMNS FROM attachments LIKE 'file_size'");
        if (sizeColumns.length === 0) {
            await pool.execute("ALTER TABLE attachments ADD COLUMN file_size BIGINT UNSIGNED DEFAULT NULL");
        }
    },

    // Tạo tin nhắn và trả về id
    async create(conversationId, senderId, content, hasAttachment = false) {
        await this.ensureRevocationColumn();
        const [result] = await pool.execute(
            'INSERT INTO messages (conversation_id, sender_id, content, has_attachment) VALUES (?, ?, ?, ?)',
            [conversationId, senderId, content, hasAttachment]
        );
        return result.insertId;
    },

    async createWithAttachments(conversationId, senderId, content, attachments) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                `INSERT INTO messages (conversation_id, sender_id, content, has_attachment)
                 VALUES (?, ?, ?, TRUE)`,
                [conversationId, senderId, content]
            );

            for (const attachment of attachments) {
                await connection.execute(
                    `INSERT INTO attachments (message_id, file_url, file_type, file_name, file_size)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        result.insertId,
                        attachment.fileUrl,
                        attachment.fileType || 'application/octet-stream',
                        attachment.fileName || null,
                        Number.isFinite(Number(attachment.fileSize)) ? Number(attachment.fileSize) : null
                    ]
                );
            }

            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    // Thêm attachment (ảnh) cho tin nhắn
    async addAttachment(messageId, fileOrUrl, legacyFileType) {
        const attachment = typeof fileOrUrl === 'string'
            ? { fileUrl: fileOrUrl, fileType: legacyFileType }
            : fileOrUrl;

        await pool.execute(
            `INSERT INTO attachments (message_id, file_url, file_type, file_name, file_size)
             VALUES (?, ?, ?, ?, ?)`,
            [
                messageId,
                attachment.fileUrl,
                attachment.fileType || 'application/octet-stream',
                attachment.fileName || null,
                Number.isFinite(Number(attachment.fileSize)) ? Number(attachment.fileSize) : null
            ]
        );
    },

    async addAttachments(messageId, attachments = []) {
        for (const attachment of attachments) {
            await this.addAttachment(messageId, attachment);
        }
    },

    async revoke(messageId) {
        await this.ensureRevocationColumn();
        await pool.execute(
            'UPDATE messages SET is_revoked = TRUE, content = NULL, has_attachment = FALSE WHERE id = ?',
            [messageId]
        );
        await pool.execute(
            'DELETE FROM attachments WHERE message_id = ?',
            [messageId]
        );
    },

    // Lấy tin nhắn theo conversationId (phân trang đơn giản, có thể thêm limit/offset)
    async getByConversation(conversationId, userId, limit = 50, offset = 0) {
        await this.ensureRevocationColumn();
        const Conversation = require('./Conversation');
        const clearedThroughMessageId = await Conversation.getClearedThroughMessageId(conversationId, userId);
        const [messages] = await pool.execute(`
      SELECT m.id, m.content, m.has_attachment, m.is_revoked, m.created_at, m.sender_id,
             COALESCE(u.display_name, u.username) as sender_username, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ? AND m.id > ?
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ? OFFSET ?
    `, [conversationId, clearedThroughMessageId, limit, offset]);

        // Với mỗi tin nhắn, lấy attachments
        const result = [];
        for (const msg of messages) {
            const [attachments] = await pool.execute(
                `SELECT file_url, file_type, file_name, file_size
                 FROM attachments
                 WHERE message_id = ?
                 ORDER BY id ASC`,
                [msg.id]
            );
            const isRevoked = Boolean(msg.is_revoked);
            result.push({
                id: msg.id,
                content: isRevoked ? 'Tin nhắn đã được thu hồi' : msg.content,
                has_attachment: isRevoked ? false : msg.has_attachment,
                revoked: isRevoked,
                created_at: msg.created_at,
                sender_id: msg.sender_id,
                sender_username: msg.sender_username,
                sender_avatar: msg.sender_avatar,
                attachments: isRevoked ? [] : attachments
            });
        }
        // Đảo ngược để tin mới nhất ở dưới cùng (phù hợp hiển thị)
        return result.reverse();
    }
};

module.exports = Message;
