const pool = require('../config/db');

const Conversation = {
    // Tạo cuộc trò chuyện mới và trả về conversation_id
    async create() {
        const [result] = await pool.execute('INSERT INTO conversations () VALUES ()');
        return result.insertId;
    },

    // Thêm thành viên vào cuộc trò chuyện
    async addMember(conversationId, userId) {
        await pool.execute(
            'INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)',
            [conversationId, userId]
        );
    },

    // Tìm cuộc trò chuyện 1-1 giữa hai user (kiểm tra tồn tại)
    async findOneToOne(user1Id, user2Id) {
        const [rows] = await pool.execute(`
      SELECT cm1.conversation_id
      FROM conversation_members cm1
      JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
      WHERE cm1.user_id = ? AND cm2.user_id = ?
      AND cm1.conversation_id IN (
        SELECT conversation_id FROM conversation_members GROUP BY conversation_id HAVING COUNT(*) = 2
      )
      LIMIT 1
    `, [user1Id, user2Id]);
        return rows.length > 0 ? rows[0].conversation_id : null;
    },

    // Lấy tất cả cuộc trò chuyện của một user (kèm tin nhắn cuối, thành viên, online status)
    async getByUserId(userId) {
        const [conversations] = await pool.execute(`
      SELECT c.id, c.created_at
      FROM conversations c
      JOIN conversation_members cm ON c.id = cm.conversation_id
      WHERE cm.user_id = ?
      ORDER BY c.created_at DESC
    `, [userId]);

        // Với mỗi conversation lấy thêm chi tiết
        const result = [];
        for (const conv of conversations) {
            // Lấy thành viên (trừ chính mình)
            const [members] = await pool.execute(`
        SELECT u.id, u.username, u.display_name, u.avatar_url
        FROM conversation_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.conversation_id = ? AND u.id != ?
      `, [conv.id, userId]);

            // Nếu conversation không có thành viên khác (trường hợp hiếm) thì bỏ qua
            if (members.length === 0) continue;

            // Lấy tin nhắn cuối
            const [lastMsg] = await pool.execute(`
        SELECT m.content, m.has_attachment, m.created_at, m.sender_id
        FROM messages m
        WHERE m.conversation_id = ?
        ORDER BY m.created_at DESC
        LIMIT 1
      `, [conv.id]);

            // Lấy số tin nhắn chưa đọc (đơn giản: nếu tin cuối không do mình gửi -> đánh dấu chưa đọc)
            // Có thể mở rộng sau: bảng read_receipt
            let unread = 0;
            if (lastMsg.length > 0 && lastMsg[0].sender_id !== userId) {
                // Tạm coi là 1 nếu có tin mới, thực tế cần cột đã đọc
                unread = 1; // sau này sẽ nâng cấp
            }

            result.push({
                id: conv.id,
                members: members,
                lastMessage: lastMsg.length > 0 ? {
                    content: lastMsg[0].content,
                    has_attachment: lastMsg[0].has_attachment,
                    created_at: lastMsg[0].created_at,
                    sender_id: lastMsg[0].sender_id
                } : null,
                unread_count: unread,
                created_at: conv.created_at
            });
        }

        return result;
    },

    // Kiểm tra user có trong conversation không
    async isMember(conversationId, userId) {
        const [rows] = await pool.execute(
            'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
            [conversationId, userId]
        );
        return rows.length > 0;
    },

    async removeMember(conversationId, userId) {
        await pool.execute(
            'DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
            [conversationId, userId]
        );
    },

    async getMemberCount(conversationId) {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) AS count FROM conversation_members WHERE conversation_id = ?',
            [conversationId]
        );
        return rows[0].count;
    },

    async deleteById(conversationId) {
        await pool.execute('DELETE FROM conversations WHERE id = ?', [conversationId]);
    }
};

module.exports = Conversation;