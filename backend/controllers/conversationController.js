const Conversation = require('../models/Conversation');

// Tạo hoặc lấy cuộc trò chuyện 1-1
exports.createOrGetConversation = async (req, res) => {
    try {
        const { userId } = req.body; // ID người muốn chat cùng
        const currentUserId = req.userId;

        if (!userId || userId == currentUserId) {
            return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
        }

        // Kiểm tra đã có cuộc trò chuyện chưa
        let conversationId = await Conversation.findOneToOne(currentUserId, userId);

        if (!conversationId) {
            // Tạo mới
            conversationId = await Conversation.create();
            await Conversation.addMember(conversationId, currentUserId);
            await Conversation.addMember(conversationId, userId);
        }

        res.json({ conversation_id: conversationId });
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

        await Conversation.removeMember(conversationId, currentUserId);
        const remainingMembers = await Conversation.getMemberCount(conversationId);

        if (remainingMembers === 0) {
            await Conversation.deleteById(conversationId);
        }

        res.json({ message: 'Đã xóa cuộc trò chuyện', conversationId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};