const jwt = require('jsonwebtoken');
const OnlineUser = require('../models/OnlineUser');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

function setupSocket(io) {
    // Middleware xác thực token
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Thiếu token'));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            next();
        } catch (err) {
            next(new Error('Token không hợp lệ'));
        }
    });

    io.on('connection', async (socket) => {
        console.log(`User ${socket.userId} connected - socket: ${socket.id}`);

        // Thêm vào bảng online_users
        await OnlineUser.add(socket.userId, socket.id);
        // Tham gia phòng riêng dựa trên userId để emit các sự kiện riêng tư
        socket.join(`user:${socket.userId}`);

        // Báo cho tất cả bạn bè (hiện tại là tất cả user khác) rằng user này online
        // Trong thực tế nên gửi cho danh sách bạn bè, nhưng chúng ta phát broadcast cho mọi client khác
        socket.broadcast.emit('user:online', { userId: socket.userId });

        // --- Xử lý tham gia phòng chat (join conversation room) ---
        socket.on('chat:join', (conversationId) => {
            socket.join(`conversation:${conversationId}`);
            console.log(`User ${socket.userId} joined room conversation:${conversationId}`);
        });

        socket.on('chat:leave', (conversationId) => {
            socket.leave(`conversation:${conversationId}`);
        });

        // --- Gửi tin nhắn ---
        socket.on('chat:message', async (data, callback) => {
            try {
                const { conversationId, content } = data;
                if (!conversationId || !content) {
                    return callback?.({ error: 'Thiếu dữ liệu' });
                }

                // Kiểm tra quyền
                const isMember = await Conversation.isMember(conversationId, socket.userId);
                if (!isMember) return callback?.({ error: 'Không có quyền' });

                // Lưu tin nhắn
                const messageId = await Message.create(conversationId, socket.userId, content, false);

                // Lấy thông tin người gửi
                const User = require('../models/User');
                const sender = await User.findById(socket.userId);

                const messageData = {
                    id: messageId,
                    conversation_id: conversationId,
                    content,
                    has_attachment: false,
                    created_at: new Date().toISOString(),
                    sender_id: socket.userId,
                    sender_username: sender.username,
                    sender_avatar: sender.avatar_url,
                    attachments: []
                };

                // Gửi cho tất cả client trong phòng conversation (bao gồm cả người gửi)
                io.to(`conversation:${conversationId}`).emit('chat:message', messageData);

                // Cập nhật danh sách conversation cho tất cả thành viên (để hiển thị last message)
                // Lấy tất cả thành viên để emit
                const [members] = await require('../config/db').execute(
                    'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
                    [conversationId]
                );
                members.forEach(member => {
                    io.to(`user:${member.user_id}`).emit('conversations:update');
                });

                callback?.({ success: true, messageId });
            } catch (error) {
                console.error(error);
                callback?.({ error: 'Lỗi máy chủ' });
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

                const messageId = await Message.create(conversationId, socket.userId, null, true);
                await Message.addAttachment(messageId, fileUrl, 'image');

                const User = require('../models/User');
                const sender = await User.findById(socket.userId);
                const messageData = {
                    id: messageId,
                    conversation_id: conversationId,
                    content: null,
                    has_attachment: true,
                    created_at: new Date().toISOString(),
                    sender_id: socket.userId,
                    sender_username: sender.username,
                    sender_avatar: sender.avatar_url,
                    attachments: [{ file_url: fileUrl, file_type: 'image' }]
                };

                io.to(`conversation:${conversationId}`).emit('chat:message', messageData);
                // Cập nhật danh sách conversation
                const [members] = await require('../config/db').execute(
                    'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
                    [conversationId]
                );
                members.forEach(member => {
                    io.to(`user:${member.user_id}`).emit('conversations:update');
                });
                callback?.({ success: true, messageId });
            } catch (error) {
                console.error(error);
                callback?.({ error: 'Lỗi máy chủ' });
            }
        });

        // --- Xử lý ngắt kết nối ---
        socket.on('disconnect', async () => {
            console.log(`User ${socket.userId} disconnected - socket: ${socket.id}`);
            // Xóa socket này khỏi online_users
            await OnlineUser.removeBySocketId(socket.id);

            // Nếu user không còn socket nào khác -> offline
            const isStillOnline = await OnlineUser.isOnline(socket.userId);
            if (!isStillOnline) {
                socket.broadcast.emit('user:offline', { userId: socket.userId });
            }
        });
    });
}

module.exports = setupSocket;