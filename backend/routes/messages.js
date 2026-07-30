const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');
const {
    uploadChatAttachments,
    uploadChatImages
} = require('../middlewares/uploadMiddleware');
const { uploadLimiter } = require('../middlewares/rateLimiters');

router.get('/:conversationId', authMiddleware, messageController.getMessages);
router.post('/', authMiddleware, messageController.sendMessage);
router.post('/file', authMiddleware, uploadLimiter, uploadChatAttachments, messageController.sendAttachment);
router.post('/image', authMiddleware, uploadLimiter, uploadChatImages, messageController.sendImage);
router.post('/revoke', authMiddleware, messageController.revokeMessage);

module.exports = router;
