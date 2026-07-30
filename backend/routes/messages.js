const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');
const {
    MAX_ATTACHMENTS,
    attachmentUpload,
    removeUploadedFiles
} = require('../config/uploads');
const { uploadLimiter } = require('../middlewares/rateLimiters');

const uploadAttachments = (req, res, next) => {
    attachmentUpload.fields([
        { name: 'files', maxCount: MAX_ATTACHMENTS },
        { name: 'file', maxCount: 1 }
    ])(req, res, async error => {
        if (!error) return next();

        await removeUploadedFiles(req.files);
        const message = error.userMessage
            || (error.code === 'LIMIT_FILE_SIZE'
                ? 'Mỗi file không được vượt quá 20 MB'
                : ['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE'].includes(error.code)
                    ? `Chỉ được gửi tối đa ${MAX_ATTACHMENTS} file mỗi lần`
                    : 'Không thể tải file lên');
        return res.status(400).json({ message });
    });
};

router.get('/:conversationId', authMiddleware, messageController.getMessages);
router.post('/', authMiddleware, messageController.sendMessage);
router.post('/file', authMiddleware, uploadLimiter, uploadAttachments, messageController.sendAttachment);
router.post('/image', authMiddleware, uploadLimiter, uploadAttachments, messageController.sendImage);
router.post('/revoke', authMiddleware, messageController.revokeMessage);

module.exports = router;
