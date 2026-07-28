const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Chỉ tìm cuộc trò chuyện đã có tin nhắn; không tạo dữ liệu khi người dùng mới mở khung chat.
exports.createOrGetConversation = async (req, res) => {
    try {
        const userId = Number(req.body.userId);
        const currentUserId = Number(req.userId);

        if (!Number.isInteger(userId) || userId <= 0 || userId === currentUserId) {
            return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
        }

        const targetUser = await User.findPublicById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        const conversationId = await Conversation.findOneToOne(currentUserId, userId);
        res.json({
            conversation_id: conversationId,
            target_user_id: userId,
            draft: !conversationId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Lấy danh sách cuộc trò chuyện của user hiện tại
exports.getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.getByUserId(req.userId);
        res.json(conversations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.deleteConversation = async (req, res) => {
    try {
        const conversationId = Number(req.params.conversationId);
        const currentUserId = req.userId;

        if (!conversationId || Number.isNaN(conversationId)) {
            return res.status(400).json({ message: 'ID cuộc trò chuyện không hợp lệ' });
        }

        const isMember = await Conversation.isMember(conversationId, currentUserId);
        if (!isMember) {
            return res.status(404).json({ message: 'Không tìm thấy cuộc trò chuyện' });
        }

        await Conversation.clearForUser(conversationId, currentUserId);

        const io = req.app.get('io');
        if (io) {
            io.to(`user:${currentUserId}`).emit('conversation:deleted', { conversationId });
        }

        res.json({ message: 'Đã xóa cuộc trò chuyện', conversationId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};
