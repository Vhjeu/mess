const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/env');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { addBlockedUser, removeBlockedUser, isBlockedBy } = require('./blockManager');
const {
    persistMessage,
    emitSavedMessage
} = require('../controllers/messageController');

const OFFLINE_GRACE_MS = 5000;
const MESSAGE_RATE_WINDOW_MS = 10_000;
const MESSAGE_RATE_LIMIT = 25;

const normalizeSocketImageUrl = value => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!normalized || normalized.length > 255) return null;
    if (normalized.startsWith('/uploads/')) return normalized;
    try {
        const url = new URL(normalized);
        return url.protocol === 'https:' ? normalized : null;
    } catch {
        return null;
    }
};

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
    const messageRateBySocket = new Map();
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
    const consumeMessageRate = socketId => {
        const now = Date.now();
        const current = messageRateBySocket.get(socketId);
        if (!current || now - current.startedAt >= MESSAGE_RATE_WINDOW_MS) {
            messageRateBySocket.set(socketId, { startedAt: now, count: 1 });
            return true;
        }
        if (current.count >= MESSAGE_RATE_LIMIT) return false;
        current.count += 1;
        return true;
    };

    // Middleware xác thực token
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Thiếu token'));

            const decoded = jwt.verify(token, getJwtSecret(), {
                algorithms: ['HS256']
            });
            const userId = Number(decoded.userId);
            if (!Number.isInteger(userId) || userId <= 0) {
                return next(new Error('Token không hợp lệ'));
            }
            socket.userId = userId;
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
        socket.on('chat:join', async (conversationId, callback) => {
            try {
                const normalizedConversationId = Number(conversationId);
                if (
                    !Number.isInteger(normalizedConversationId)
                    || normalizedConversationId <= 0
                    || !await Conversation.isMember(normalizedConversationId, userId)
                ) {
                    return callback?.({ error: 'Không có quyền truy cập cuộc trò chuyện' });
                }
                await socket.join(`conversation:${normalizedConversationId}`);
                callback?.({ success: true });
            } catch (error) {
                console.error('Không thể tham gia phòng chat:', error);
                callback?.({ error: 'Lỗi máy chủ' });
            }
        });

        socket.on('chat:leave', (conversationId) => {
            const normalizedConversationId = Number(conversationId);
            if (Number.isInteger(normalizedConversationId) && normalizedConversationId > 0) {
                socket.leave(`conversation:${normalizedConversationId}`);
            }
        });

        socket.on('chat:block-user', async (data = {}, callback) => {
            try {
                const targetUserId = Number(data.targetUserId);
                if (!Number.isInteger(targetUserId) || targetUserId <= 0 || targetUserId === userId) {
                    return callback?.({ error: 'ID người dùng không hợp lệ' });
                }
                await addBlockedUser(userId, targetUserId);
                callback?.({ success: true });
            } catch (error) {
                console.error('Không thể chặn người dùng:', error);
                callback?.({ error: 'Lỗi máy chủ' });
            }
        });

        socket.on('chat:unblock-user', async (data = {}, callback) => {
            try {
                const targetUserId = Number(data.targetUserId);
                if (!Number.isInteger(targetUserId) || targetUserId <= 0 || targetUserId === userId) {
                    return callback?.({ error: 'ID người dùng không hợp lệ' });
                }
                await removeBlockedUser(userId, targetUserId);
                callback?.({ success: true });
            } catch (error) {
                console.error('Không thể bỏ chặn người dùng:', error);
                callback?.({ error: 'Lỗi máy chủ' });
            }
        });

        // --- Gửi tin nhắn ---
        socket.on('chat:message', async (data, callback) => {
            try {
                if (!consumeMessageRate(socket.id)) {
                    return callback?.({ error: 'Bạn đang gửi tin nhắn quá nhanh' });
                }
                if (!data || typeof data !== 'object') {
                    return callback?.({ error: 'Dữ liệu tin nhắn không hợp lệ' });
                }
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
        socket.on('chat:image', async (data = {}, callback) => {
            try {
                if (!consumeMessageRate(socket.id)) {
                    return callback?.({ error: 'Bạn đang gửi nội dung quá nhanh' });
                }
                const conversationId = Number(data.conversationId);
                const fileUrl = normalizeSocketImageUrl(data.fileUrl);
                if (
                    !Number.isInteger(conversationId)
                    || conversationId <= 0
                    || !fileUrl
                ) {
                    return callback?.({ error: 'Dữ liệu ảnh không hợp lệ' });
                }

                const isMember = await Conversation.isMember(conversationId, socket.userId);
                if (!isMember) return callback?.({ error: 'Không có quyền' });

                const [members] = await require('../config/db').execute(
                    'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
                    [conversationId]
                );

                const senderId = Number(socket.userId);
                const blockChecks = await Promise.all(members.map(member => {
                    const recipientId = Number(member.user_id);
                    return recipientId !== senderId
                        ? isBlockedBy(recipientId, senderId)
                        : false;
                }));
                const isBlockedByRecipient = blockChecks.some(Boolean);

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
            messageRateBySocket.delete(socket.id);

            clearPendingOffline(userId);
            const timer = setTimeout(async () => {
                pendingOfflineTimers.delete(userId);
                if (getUserSocketCount(userId) > 0) return;
                io.emit('user:offline', { userId });
            }, OFFLINE_GRACE_MS);
            pendingOfflineTimers.set(userId, timer);
        });
    });

    return () => {
        pendingOfflineTimers.forEach(timer => clearTimeout(timer));
        pendingOfflineTimers.clear();
        messageRateBySocket.clear();
    };
}

module.exports = setupSocket;
