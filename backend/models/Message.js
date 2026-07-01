const pool = require('../config/db');

const Message = {
    // Tạo tin nhắn và trả về id
    async create(conversationId, senderId, content, hasAttachment = false) {
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

    // Lấy tin nhắn theo conversationId (phân trang đơn giản, có thể thêm limit/offset)
    async getByConversation(conversationId, limit = 50, offset = 0) {
        const [messages] = await pool.execute(`
      SELECT m.id, m.content, m.has_attachment, m.created_at, m.sender_id,
             u.username as sender_username, u.avatar_url as sender_avatar
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
            result.push({
                id: msg.id,
                content: msg.content,
                has_attachment: msg.has_attachment,
                created_at: msg.created_at,
                sender_id: msg.sender_id,
                sender_username: msg.sender_username,
                sender_avatar: msg.sender_avatar,
                attachments: attachments
            });
        }
        // Đảo ngược để tin mới nhất ở dưới cùng (phù hợp hiển thị)
        return result.reverse();
    }
};

module.exports = Message;