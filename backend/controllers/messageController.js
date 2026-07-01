const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

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

// Gửi ảnh
exports.sendImage = async (req, res) => {
    try {
        const { conversationId } = req.body;
        const senderId = req.userId;

        if (!req.file) {
            return res.status(400).json({ message: 'Chưa có file ảnh' });
        }
        if (!conversationId) {
            return res.status(400).json({ message: 'Thiếu conversationId' });
        }

        const isMember = await Conversation.isMember(conversationId, senderId);
        if (!isMember) return res.status(403).json({ message: 'Không có quyền' });

        // Lưu đường dẫn file
        const fileUrl = `/uploads/${req.file.filename}`;
        const messageId = await Message.create(conversationId, senderId, null, true);
        await Message.addAttachment(messageId, fileUrl, req.file.mimetype);

        res.status(201).json({ message: 'Ảnh đã được gửi', messageId, fileUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};