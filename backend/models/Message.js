const pool = require('../config/db');

const Message = {
    async ensureRevocationColumn() {
        const [columns] = await pool.query("SHOW COLUMNS FROM messages LIKE 'is_revoked'");
        if (columns.length === 0) {
            await pool.execute("ALTER TABLE messages ADD COLUMN is_revoked BOOLEAN DEFAULT FALSE");
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

    // Thêm attachment (ảnh) cho tin nhắn
    async addAttachment(messageId, fileUrl, fileType) {
        await pool.execute(
            'INSERT INTO attachments (message_id, file_url, file_type) VALUES (?, ?, ?)',
            [messageId, fileUrl, fileType]
        );
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
    async getByConversation(conversationId, limit = 50, offset = 0) {
        await this.ensureRevocationColumn();
        const [messages] = await pool.execute(`
      SELECT m.id, m.content, m.has_attachment, m.is_revoked, m.created_at, m.sender_id,
             COALESCE(u.display_name, u.username) as sender_username, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [conversationId, limit, offset]);

        // Với mỗi tin nhắn, lấy attachments
        const result = [];
        for (const msg of messages) {
            const [attachments] = await pool.execute(
                'SELECT file_url, file_type FROM attachments WHERE message_id = ?',
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