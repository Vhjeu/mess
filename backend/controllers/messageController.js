const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { isBlockedBy } = require('../socket/blockManager');

const checkIfSenderBlocked = async (conversationId, senderId) => {
    const [members] = await require('../config/db').execute(
        'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
        [conversationId]
    );

    const currentSenderId = Number(senderId);
    return members.some(member => {
        const recipientId = Number(member.user_id);
        return recipientId !== currentSenderId && isBlockedBy(recipientId, currentSenderId);
    });
};

// Gửi tin nhắn văn bản (qua REST, nhưng socket sẽ dùng trực tiếp nên REST này ít dùng)
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, content } = req.body;
        const senderId = req.userId;

        if (!conversationId || !content) {
            return res.status(400).json({ message: 'Thiếu conversationId hoặc nội dung' });
        }

        // Kiểm tra quyền
        const isMember = await Conversation.isMember(conversationId, senderId);
        if (!isMember) return res.status(403).json({ message: 'Bạn không thuộc cuộc trò chuyện này' });

        const blocked = await checkIfSenderBlocked(conversationId, senderId);
        if (blocked) {
            return res.status(403).json({ message: 'Bạn đã bị chặn nên không thể gửi tin nhắn cho người này' });
        }

        const messageId = await Message.create(conversationId, senderId, content, false);
        // Lấy thông tin đầy đủ để trả về
        res.status(201).json({ message: 'Gửi thành công', messageId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Lấy tin nhắn của một cuộc trò chuyện
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const senderId = req.userId;

        const isMember = await Conversation.isMember(conversationId, senderId);
        if (!isMember) return res.status(403).json({ message: 'Không có quyền truy cập' });

        const messages = await Message.getByConversation(conversationId);
        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Gửi file đính kèm (ảnh hoặc tài liệu)
exports.sendAttachment = async (req, res) => {
    try {
        const { conversationId } = req.body;
        const senderId = req.userId;

        if (!req.file) {
            return res.status(400).json({ message: 'Chưa có file' });
        }
        if (!conversationId) {
            return res.status(400).json({ message: 'Thiếu conversationId' });
        }

        const isMember = await Conversation.isMember(conversationId, senderId);
        if (!isMember) return res.status(403).json({ message: 'Không có quyền' });

        const blocked = await checkIfSenderBlocked(conversationId, senderId);
        if (blocked) {
            return res.status(403).json({ message: 'Bạn đã bị chặn nên không thể gửi tệp này' });
        }

        const fileType = req.file.mimetype || 'application/octet-stream';
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        const messageId = await Message.create(conversationId, senderId, null, true);
        await Message.addAttachment(messageId, fileUrl, fileType);

        const io = req.app.get('io');
        if (io) {
            const User = require('../models/User');
            const sender = await User.findById(senderId);
            const messageData = {
                id: messageId,
                conversation_id: Number(conversationId),
                content: null,
                has_attachment: true,
                created_at: new Date().toISOString(),
                sender_id: Number(senderId),
                sender_username: sender.display_name || sender.username,
                sender_avatar: sender.avatar_url,
                attachments: [{ file_url: fileUrl, file_type: fileType, file_name: req.file.originalname }]
            };

            io.to(`conversation:${conversationId}`).emit('chat:message', messageData);

            const [members] = await require('../config/db').execute(
                'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
                [conversationId]
            );
            members.forEach(member => {
                io.to(`user:${member.user_id}`).emit('conversations:update');
            });
        }

        res.status(201).json({
            message: 'File đã được gửi',
            messageId,
            fileUrl,
            fileName: req.file.originalname,
            fileType
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.sendImage = async (req, res) => {
    return exports.sendAttachment(req, res);
};

exports.revokeMessage = async (req, res) => {
    try {
        const { messageId, conversationId } = req.body;
        const senderId = req.userId;

        if (!messageId || !conversationId) {
            return res.status(400).json({ message: 'Thiếu messageId hoặc conversationId' });
        }

        const [rows] = await require('../config/db').execute(
            'SELECT sender_id FROM messages WHERE id = ? AND conversation_id = ?',
            [messageId, conversationId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Tin nhắn không tồn tại' });
        }

        const isMember = await Conversation.isMember(conversationId, senderId);
        if (!isMember) {
            return res.status(403).json({ message: 'Bạn không thuộc cuộc trò chuyện này' });
        }

        if (rows[0].sender_id !== senderId) {
            return res.status(403).json({ message: 'Bạn không thể thu hồi tin nhắn này' });
        }

        await Message.revoke(messageId);

        const io = req.app.get('io');
        if (io) {
            io.to(`conversation:${conversationId}`).emit('chat:message:revoked', { messageId, conversationId });

            const [members] = await require('../config/db').execute(
                'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
                [conversationId]
            );
            members.forEach(member => {
                io.to(`user:${member.user_id}`).emit('conversations:update');
            });
        }

        res.status(200).json({ message: 'Thu hồi tin nhắn thành công' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};