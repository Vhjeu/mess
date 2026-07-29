const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/env');
const OnlineUser = require('../models/OnlineUser');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { getBlockedUsers, addBlockedUser, removeBlockedUser, isBlockedBy } = require('./blockManager');
const {
    persistMessage,
    emitSavedMessage
} = require('../controllers/messageController');

const OFFLINE_GRACE_MS = 5000;

const emitConversationUpdate = (io, members, messageData) => {
    const payload = {
        conversationId: Number(messageData.conversation_id),
        lastMessage: {
            id: messageData.id,
            content: messageData.content,
            has_attachment: Boolean(messageData.has_attachment),
            created_at: messageData.created_at,
            sender_id: Number(messageData.sender_id)
        }
    };

    members.forEach(member => {
        io.to(`user:${member.user_id}`).emit('conversations:update', payload);
    });
};

function setupSocket(io) {
    const pendingOfflineTimers = new Map();
    const userRoom = userId => `user:${Number(userId)}`;
    const getConnectedUserIds = () => {
        const userIds = [];
        for (const [roomName, socketIds] of io.sockets.adapter.rooms) {
            if (!roomName.startsWith('user:') || socketIds.size === 0) continue;
            const userId = Number(roomName.slice(5));
            if (Number.isInteger(userId) && userId > 0) userIds.push(userId);
        }
        return [...new Set(userIds)];
    };
    const getUserSocketCount = userId => (
        io.sockets.adapter.rooms.get(userRoom(userId))?.size || 0
    );
    const clearPendingOffline = userId => {
        const normalizedUserId = Number(userId);
        const timer = pendingOfflineTimers.get(normalizedUserId);
        if (timer) clearTimeout(timer);
        pendingOfflineTimers.delete(normalizedUserId);
    };

    // Middleware xác thực token
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Thiếu token'));

            const decoded = jwt.verify(token, getJwtSecret());
            socket.userId = decoded.userId;
            next();
        } catch (err) {
            next(new Error('Token không hợp lệ'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = Number(socket.userId);
        const roomName = userRoom(userId);
        clearPendingOffline(userId);

        // Room size là nguồn trạng thái tức thời và hỗ trợ nhiều tab.
        await socket.join(roomName);
        const socketCount = getUserSocketCount(userId);
        console.log(`User ${userId} connected - socket: ${socket.id} - active sockets: ${socketCount}`);

        try {
            await OnlineUser.add(userId, socket.id);
        } catch (error) {
            console.error('Không thể đồng bộ trạng thái online vào MySQL:', error);
        }

        // Chỉ phát chuyển trạng thái khi đây là socket đầu tiên của user.
        if (socketCount === 1) {
            socket.broadcast.emit('user:online', { userId });
        }

        const getPresenceSnapshot = () => ({
            userIds: getConnectedUserIds()
        });
        socket.emit('presence:snapshot', getPresenceSnapshot());
        socket.on('presence:get', (callback) => {
            callback?.(getPresenceSnapshot());
        });

        // --- Xử lý tham gia phòng chat (join conversation room) ---
        socket.on('chat:join', (conversationId) => {
            socket.join(`conversation:${conversationId}`);
            console.log(`User ${socket.userId} joined room conversation:${conversationId}`);
        });

        socket.on('chat:leave', (conversationId) => {
            socket.leave(`conversation:${conversationId}`);
        });

        socket.on('chat:block-user', ({ targetUserId }, callback) => {
            if (!targetUserId) return callback?.({ error: 'Thiếu targetUserId' });
            addBlockedUser(socket.userId, targetUserId);
            callback?.({ success: true });
        });

        socket.on('chat:unblock-user', ({ targetUserId }, callback) => {
            if (!targetUserId) return callback?.({ error: 'Thiếu targetUserId' });
            removeBlockedUser(socket.userId, targetUserId);
            callback?.({ success: true });
        });

        // --- Gửi tin nhắn ---
        socket.on('chat:message', async (data, callback) => {
            try {
                const { conversationId, targetUserId, content } = data;
                const normalizedContent = typeof content === 'string' ? content.trim() : '';
                if (!normalizedContent) {
                    return callback?.({ error: 'Nội dung tin nhắn không được để trống' });
                }

                const saved = await persistMessage({
                    conversationId,
                    targetUserId,
                    senderId: socket.userId,
                    content: normalizedContent
                });

                await socket.join(`conversation:${saved.conversationId}`);
                await emitSavedMessage(io, {
                    ...saved,
                    senderId: socket.userId,
                    content: normalizedContent,
                    hasAttachment: false
                });

                callback?.({
                    success: true,
                    messageId: saved.messageId,
                    conversationId: saved.conversationId
                });
            } catch (error) {
                console.error(error);
                callback?.({ error: error.status ? error.message : 'Lỗi máy chủ' });
            }
        });

        // --- Gửi ảnh (qua socket, nhưng client gửi base64 hoặc URL) ---
        // Có thể sử dụng REST upload ảnh rồi emit socket, nhưng ta hỗ trợ thêm nếu client gửi ảnh qua socket
        socket.on('chat:image', async (data, callback) => {
            try {
                const { conversationId, fileUrl } = data; // giả sử client đã upload ảnh lên và có url
                if (!conversationId || !fileUrl) return callback?.({ error: 'Thiếu dữ liệu' });

                const isMember = await Conversation.isMember(conversationId, socket.userId);
                if (!isMember) return callback?.({ error: 'Không có quyền' });

                const [members] = await require('../config/db').execute(
                    'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
                    [conversationId]
                );

                const senderId = Number(socket.userId);
                const isBlockedByRecipient = members.some(member => {
                    const recipientId = Number(member.user_id);
                    return recipientId !== senderId && isBlockedBy(recipientId, senderId);
                });

                if (isBlockedByRecipient) {
                    return callback?.({ error: 'Bạn đã bị chặn nên không thể gửi ảnh cho người này' });
                }

                const messageId = await Message.create(conversationId, socket.userId, null, true);
                await Message.addAttachment(messageId, fileUrl, 'image');

                const User = require('../models/User');
                const sender = await User.findById(socket.userId);
                const messageData = {
                    id: messageId,
                    conversation_id: Number(conversationId),
                    content: null,
                    has_attachment: true,
                    created_at: new Date().toISOString(),
                    sender_id: Number(socket.userId),
                    sender_username: sender.display_name || sender.username,
                    sender_avatar: sender.avatar_url,
                    attachments: [{ file_url: fileUrl, file_type: 'image' }]
                };

                io.to(`conversation:${conversationId}`).emit('chat:message', messageData);
                // Cập nhật danh sách conversation
                emitConversationUpdate(io, members, messageData);
                callback?.({ success: true, messageId });
            } catch (error) {
                console.error(error);
                callback?.({ error: 'Lỗi máy chủ' });
            }
        });

        // --- Xử lý ngắt kết nối ---
        socket.on('disconnect', async (reason) => {
            console.log(`User ${userId} disconnected - socket: ${socket.id} - reason: ${reason}`);
            try {
                await OnlineUser.removeBySocketId(socket.id);
            } catch (error) {
                console.error('Không thể xóa trạng thái socket khỏi MySQL:', error);
            }

            clearPendingOffline(userId);
            const timer = setTimeout(async () => {
                pendingOfflineTimers.delete(userId);
                if (getUserSocketCount(userId) > 0) return;

                try {
                    await OnlineUser.removeAllByUserId(userId);
                } catch (error) {
                    console.error('Không thể dọn trạng thái offline trong MySQL:', error);
                }
                io.emit('user:offline', { userId });
            }, OFFLINE_GRACE_MS);
            pendingOfflineTimers.set(userId, timer);
        });
    });
}

module.exports = setupSocket;
