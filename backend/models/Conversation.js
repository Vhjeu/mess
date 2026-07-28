const pool = require('../config/db');

const Conversation = {
    async ensureMemberStateColumns() {
        const [clearedColumns] = await pool.query(
            "SHOW COLUMNS FROM conversation_members LIKE 'cleared_through_message_id'"
        );
        if (clearedColumns.length === 0) {
            await pool.execute(`
                ALTER TABLE conversation_members
                ADD COLUMN cleared_through_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0
            `);
        }

        const [hiddenColumns] = await pool.query(
            "SHOW COLUMNS FROM conversation_members LIKE 'hidden_at'"
        );
        if (hiddenColumns.length === 0) {
            await pool.execute(`
                ALTER TABLE conversation_members
                ADD COLUMN hidden_at DATETIME(6) DEFAULT NULL
            `);
        }
    },

    async initialize() {
        await this.ensureMemberStateColumns();
    },

    async create() {
        const [result] = await pool.execute('INSERT INTO conversations () VALUES ()');
        return result.insertId;
    },

    async addMember(conversationId, userId) {
        await pool.execute(
            'INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)',
            [conversationId, userId]
        );
    },

    async findOneToOne(user1Id, user2Id) {
        const [rows] = await pool.execute(`
            SELECT cm1.conversation_id
            FROM conversation_members cm1
            JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
            WHERE cm1.user_id = ? AND cm2.user_id = ?
              AND cm1.conversation_id IN (
                SELECT conversation_id
                FROM conversation_members
                GROUP BY conversation_id
                HAVING COUNT(*) = 2
              )
            LIMIT 1
        `, [user1Id, user2Id]);
        return rows.length > 0 ? rows[0].conversation_id : null;
    },

    async restoreForUser(conversationId, userId) {
        await pool.execute(
            `UPDATE conversation_members
             SET hidden_at = NULL
             WHERE conversation_id = ? AND user_id = ?`,
            [conversationId, userId]
        );
    },

    async getByUserId(userId) {
        const [conversations] = await pool.execute(`
            SELECT c.id, c.created_at, cm.cleared_through_message_id
            FROM conversations c
            JOIN conversation_members cm ON c.id = cm.conversation_id
            WHERE cm.user_id = ?
              AND (
                cm.hidden_at IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM messages visible_message
                    WHERE visible_message.conversation_id = c.id
                      AND visible_message.id > cm.cleared_through_message_id
                )
              )
        `, [userId]);

        const result = [];
        for (const conv of conversations) {
            const [members] = await pool.execute(`
                SELECT u.id, u.username, u.display_name, u.avatar_url
                FROM conversation_members cm
                JOIN users u ON cm.user_id = u.id
                WHERE cm.conversation_id = ? AND u.id != ?
            `, [conv.id, userId]);

            if (members.length === 0) continue;

            const [lastMsg] = await pool.execute(`
                SELECT m.id, m.content, m.has_attachment, m.created_at, m.sender_id
                FROM messages m
                WHERE m.conversation_id = ? AND m.id > ?
                ORDER BY m.created_at DESC, m.id DESC
                LIMIT 1
            `, [conv.id, conv.cleared_through_message_id]);

            let unread = 0;
            if (lastMsg.length > 0 && Number(lastMsg[0].sender_id) !== Number(userId)) {
                unread = 1;
            }

            result.push({
                id: conv.id,
                members,
                lastMessage: lastMsg.length > 0 ? {
                    id: lastMsg[0].id,
                    content: lastMsg[0].content,
                    has_attachment: Boolean(lastMsg[0].has_attachment),
                    created_at: lastMsg[0].created_at,
                    sender_id: lastMsg[0].sender_id
                } : null,
                unread_count: unread,
                created_at: conv.created_at
            });
        }

        return result.sort((a, b) => {
            const aTime = new Date(a.lastMessage?.created_at || a.created_at).getTime();
            const bTime = new Date(b.lastMessage?.created_at || b.created_at).getTime();
            if (bTime !== aTime) return bTime - aTime;
            return Number(b.lastMessage?.id || 0) - Number(a.lastMessage?.id || 0);
        });
    },

    async isMember(conversationId, userId) {
        const [rows] = await pool.execute(
            'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
            [conversationId, userId]
        );
        return rows.length > 0;
    },

    async clearForUser(conversationId, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [messageRows] = await connection.execute(
                'SELECT COALESCE(MAX(id), 0) AS latest_message_id FROM messages WHERE conversation_id = ?',
                [conversationId]
            );
            const latestMessageId = Number(messageRows[0].latest_message_id);

            const [result] = await connection.execute(`
                UPDATE conversation_members
                SET
                    cleared_through_message_id = GREATEST(cleared_through_message_id, ?),
                    hidden_at = CURRENT_TIMESTAMP(6)
                WHERE conversation_id = ? AND user_id = ?
            `, [latestMessageId, conversationId, userId]);

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    async getClearedThroughMessageId(conversationId, userId) {
        const [rows] = await pool.execute(
            `SELECT cleared_through_message_id
             FROM conversation_members
             WHERE conversation_id = ? AND user_id = ?`,
            [conversationId, userId]
        );
        return rows.length > 0 ? Number(rows[0].cleared_through_message_id) : 0;
    }
};

module.exports = Conversation;
