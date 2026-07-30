const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const { avatarUpload, removeUploadedFiles } = require('../config/uploads');
const {
    accountEmailLimiter,
    uploadLimiter
} = require('../middlewares/rateLimiters');

const uploadAvatar = (req, res, next) => {
    avatarUpload.single('avatar')(req, res, async error => {
        if (!error) return next();
        await removeUploadedFiles(req.file ? [req.file] : []);
        return res.status(400).json({
            message: error.userMessage
                || (error.code === 'LIMIT_FILE_SIZE'
                    ? 'Ảnh đại diện không được vượt quá 5 MB'
                    : 'Không thể tải ảnh đại diện lên')
        });
    });
};

router.get('/', authMiddleware, userController.getAllUsers);
router.get('/me', authMiddleware, userController.getMe);
router.get('/nicknames', authMiddleware, userController.getNicknames);
router.get('/:targetUserId/nickname', authMiddleware, userController.getNickname);
router.put('/:targetUserId/nickname', authMiddleware, userController.updateNickname);
router.put('/me', authMiddleware, userController.updateProfile);
router.post('/me/avatar', authMiddleware, uploadLimiter, uploadAvatar, userController.uploadAvatar);
router.post('/me/email/change/start', authMiddleware, accountEmailLimiter, userController.startEmailChange);
router.post('/me/email/change/verify-current', authMiddleware, accountEmailLimiter, userController.verifyCurrentEmailForChange);
router.post('/me/email/request', authMiddleware, accountEmailLimiter, userController.requestEmailVerification);
router.post('/me/email/resend', authMiddleware, accountEmailLimiter, userController.resendEmailVerification);
router.post('/me/email/verify', authMiddleware, accountEmailLimiter, userController.verifyEmail);
router.delete('/me/email/pending', authMiddleware, userController.cancelEmailVerification);
router.put('/me/password', authMiddleware, userController.changePassword);
router.get('/:userId', authMiddleware, userController.getUserById);

module.exports = router;
