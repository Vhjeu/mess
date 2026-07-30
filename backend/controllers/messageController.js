const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { isBlockedBy } = require('../socket/blockManager');
const pool = require('../config/db');
const {
    deleteStoredMedia,
    rollbackUploadedObjects,
    uploadFiles
} = require('../services/media.service');
const { validateUploadedImages } = require('../utils/imageFile');
const MAX_MESSAGE_BYTES = 60 * 1024;

const getConversationMembers = async (conversationId) => {
    const [members] = await pool.execute(
        'SELECT user_id FROM conversation_members WHERE conversation_id = ?',
        [conversationId]
    );
    return members;
};

const isSenderBlockedByRecipient = async (members, senderId) => {
    const currentSenderId = Number(senderId);
    const results = await Promise.all(members.map(member => {
        const recipientId = Number(member.user_id);
        return recipientId !== currentSenderId
            ? isBlockedBy(recipientId, currentSenderId)
            : false;
    }));
    return results.some(Boolean);
};

const createRequestError = (status, message) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

const persistMessage = async ({
    conversationId,
    targetUserId,
    senderId,
    content = null,
    hasAttachment = false,
    attachment = null,
    attachments = []
}) => {
    if (typeof content === 'string' && Buffer.byteLength(content, 'utf8') > MAX_MESSAGE_BYTES) {
        throw createRequestError(400, 'Nội dung tin nhắn quá dài');
    }
    const normalizedAttachments = attachments.length
        ? attachments
        : (attachment ? [attachment] : []);
    const parsedConversationId = Number(conversationId);
    if (Number.isInteger(parsedConversationId) && parsedConversationId > 0) {
        const isMember = await Conversation.isMember(parsedConversationId, senderId);
        if (!isMember) {
            throw createRequestError(403, 'Bạn không thuộc cuộc trò chuyện này');
        }

        const members = await getConversationMembers(parsedConversationId);
        if (await isSenderBlockedByRecipient(members, senderId)) {
            throw createRequestError(403, 'Bạn đã bị chặn nên không thể gửi nội dung này');
        }

        const messageId = normalizedAttachments.length
            ? await Message.createWithAttachments(
                parsedConversationId,
                senderId,
                content,
                normalizedAttachments
            )
            : await Message.create(
                parsedConversationId,
                senderId,
                content,
                hasAttachment
            );

        return { conversationId: parsedConversationId, messageId, members };
    }

    const parsedTargetUserId = Number(targetUserId);
    if (
        !Number.isInteger(parsedTargetUserId)
        || parsedTargetUserId <= 0
        || parsedTargetUserId === Number(senderId)
    ) {
        throw createRequestError(400, 'ID người nhận không hợp lệ');
    }
    if (await isBlockedBy(parsedTargetUserId, Number(senderId))) {
        throw createRequestError(403, 'Bạn đã bị chặn nên không thể gửi nội dung này');
    }

    let result;
    try {
        result = await Conversation.createOrReuseWithFirstMessage(senderId, parsedTargetUserId, {
            content,
            hasAttachment,
            attachments: normalizedAttachments
        });
    } catch (error) {
        if (error.code === 'TARGET_USER_NOT_FOUND') {
            throw createRequestError(404, error.message);
        }
        throw error;
    }

    return {
        ...result,
        members: await getConversationMembers(result.conversationId)
    };
};

const emitSavedMessage = async (io, {
    conversationId,
    messageId,
    members,
    senderId,
    content,
    hasAttachment,
    attachments = [],
    clientUploadId = null
}) => {
    const User = require('../models/User');
    const sender = await User.findById(senderId);
    const messageData = {
        id: messageId,
        conversation_id: Number(conversationId),
        content,
        has_attachment: Boolean(hasAttachment),
        created_at: new Date().toISOString(),
        sender_id: Number(senderId),
        sender_username: sender.display_name || sender.username,
        sender_avatar: sender.avatar_url,
        attachments,
        ...(clientUploadId ? { client_upload_id: clientUploadId } : {})
    };

    io.to(`conversation:${conversationId}`).emit('chat:message', messageData);
    members.forEach(member => {
        io.to(`user:${member.user_id}`).emit('conversations:update', {
            conversationId: Number(conversationId),
            lastMessage: {
                id: messageData.id,
                content: messageData.content,
                has_attachment: Boolean(messageData.has_attachment),
                created_at: messageData.created_at,
                sender_id: Number(messageData.sender_id)
            }
        });
    });

    return messageData;
};

exports.persistMessage = persistMessage;
exports.emitSavedMessage = emitSavedMessage;

// Gửi tin nhắn văn bản (qua REST, nhưng socket sẽ dùng trực tiếp nên REST này ít dùng)
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, targetUserId, content } = req.body;
        const senderId = req.userId;
        const normalizedContent = typeof content === 'string' ? content.trim() : '';

        if (!normalizedContent) {
            return res.status(400).json({ message: 'Nội dung tin nhắn không được để trống' });
        }

        const saved = await persistMessage({
            conversationId,
            targetUserId,
            senderId,
            content: normalizedContent
        });

        const io = req.app.get('io');
        if (io) {
            await emitSavedMessage(io, {
                ...saved,
                senderId,
                content: normalizedContent,
                hasAttachment: false
            });
        }

        res.status(201).json({
            message: 'Gửi thành công',
            messageId: saved.messageId,
            conversationId: saved.conversationId
        });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ message: error.status ? error.message : 'Lỗi máy chủ' });
    }
};

// Lấy tin nhắn của một cuộc trò chuyện
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const senderId = req.userId;

        const isMember = await Conversation.isMember(conversationId, senderId);
        if (!isMember) return res.status(403).json({ message: 'Không có quyền truy cập' });

        const messages = await Message.getByConversation(conversationId, senderId);
        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Gửi file đính kèm (ảnh hoặc tài liệu)
exports.sendAttachment = async (req, res) => {
    const startedAt = Date.now();
    let stage = 'validation';
    const uploadedFiles = Array.isArray(req.files)
        ? req.files
        : Object.values(req.files || {}).flat();
    let filesPersisted = false;
    let uploadedObjects = [];
    try {
        const { conversationId, targetUserId, content } = req.body;
        const senderId = req.userId;
        const clientUploadId = typeof req.body.clientUploadId === 'string'
            ? req.body.clientUploadId.trim().slice(0, 100)
            : null;
        const normalizedContent = typeof content === 'string' && content.trim()
            ? content.trim()
            : null;

        if (!uploadedFiles.length) {
            return res.status(400).json({ message: 'Chưa có file đính kèm' });
        }

        await validateUploadedImages(uploadedFiles);
        stage = 'cloudinary_upload';
        uploadedObjects = await uploadFiles(uploadedFiles, {
            imagePrefix: 'chat',
            filePrefix: 'files'
        });
        const attachments = uploadedObjects.map(item => ({
            fileUrl: item.url,
            fileType: item.contentType.slice(0, 50),
            fileName: item.originalName,
            fileSize: item.size,
            filePublicId: item.publicId,
            resourceType: item.resourceType
        }));
        stage = 'database_write';
        const saved = await persistMessage({
            conversationId,
            targetUserId,
            senderId,
            content: normalizedContent,
            hasAttachment: true,
            attachments
        });
        filesPersisted = true;

        stage = 'socket_emit';
        const responseAttachments = attachments.map(item => ({
            file_url: item.fileUrl,
            file_type: item.fileType,
            file_name: item.fileName,
            file_size: item.fileSize
        }));
        const io = req.app.get('io');
        let savedMessage = {
            id: saved.messageId,
            conversation_id: saved.conversationId,
            content: normalizedContent,
            has_attachment: true,
            created_at: new Date().toISOString(),
            sender_id: Number(senderId),
            attachments: responseAttachments,
            ...(clientUploadId ? { client_upload_id: clientUploadId } : {})
        };
        if (io) {
            try {
                savedMessage = await emitSavedMessage(io, {
                    ...saved,
                    senderId,
                    content: normalizedContent,
                    hasAttachment: true,
                    attachments: responseAttachments,
                    clientUploadId
                });
            } catch (emitError) {
                console.error('Không thể phát tin nhắn file qua socket:', emitError);
            }
        }

        res.status(201).json({
            message: 'File đã được gửi',
            messageId: saved.messageId,
            conversationId: saved.conversationId,
            attachments: responseAttachments,
            savedMessage,
            fileUrl: responseAttachments[0].file_url,
            fileName: responseAttachments[0].file_name,
            fileType: responseAttachments[0].file_type
        });
    } catch (error) {
        if (!filesPersisted) {
            await rollbackUploadedObjects(uploadedObjects);
        }
        console.error('[media]', {
            operation: 'chat_attachment_upload',
            stage,
            user_id: Number(req.userId),
            duration_ms: Date.now() - startedAt,
            error_code: error.code || error.name || 'MEDIA_UPLOAD_FAILED'
        });
        const status = error.status || 500;
        res.status(status).json({
            success: false,
            code: error.code || (status === 500 ? 'MEDIA_UPLOAD_FAILED' : 'INVALID_UPLOAD'),
            message: error.expose || status < 500
                ? error.message
                : 'Lỗi máy chủ'
        });
    } finally {
        uploadedFiles.forEach(file => {
            if (file) file.buffer = null;
        });
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

        const revokedAttachments = await Message.getAttachmentStorage(messageId);
        await deleteStoredMedia(revokedAttachments);
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
