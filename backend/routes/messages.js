const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');

// Cấu hình multer lưu ảnh
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Đặt tên file duy nhất
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        cb(null, true);
    }
});

const uploadAttachments = (req, res, next) => {
    upload.fields([
        { name: 'files', maxCount: 10 },
        { name: 'file', maxCount: 1 }
    ])(req, res, error => {
        if (!error) return next();

        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Mỗi file không được vượt quá 20 MB'
            : error.code === 'LIMIT_UNEXPECTED_FILE'
                ? 'Chỉ được gửi tối đa 10 file mỗi lần'
                : 'Không thể tải file lên';
        return res.status(400).json({ message });
    });
};

router.get('/:conversationId', authMiddleware, messageController.getMessages);
router.post('/', authMiddleware, messageController.sendMessage);
router.post('/file', authMiddleware, uploadAttachments, messageController.sendAttachment);
router.post('/image', authMiddleware, uploadAttachments, messageController.sendImage);
router.post('/revoke', authMiddleware, messageController.revokeMessage);

module.exports = router;
