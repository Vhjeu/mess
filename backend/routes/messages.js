const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');
const {
    MAX_ATTACHMENTS,
    attachmentUpload
} = require('../config/uploads');

const uploadAttachments = (req, res, next) => {
    attachmentUpload.fields([
        { name: 'files', maxCount: MAX_ATTACHMENTS },
        { name: 'file', maxCount: 1 }
    ])(req, res, error => {
        if (!error) return next();

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
router.post('/file', authMiddleware, uploadAttachments, messageController.sendAttachment);
router.post('/image', authMiddleware, uploadAttachments, messageController.sendImage);
router.post('/revoke', authMiddleware, messageController.revokeMessage);

module.exports = router;
